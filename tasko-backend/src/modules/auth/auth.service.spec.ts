import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import {
  SocialLinkConfirmationRequiredError,
  UnauthorizedError,
} from '../../common/errors/domain-error';
import { AuthProvider } from '../../common/constants/auth-provider.enum';
import { Role } from '../../common/constants/role.enum';
import { FirebaseAdminService } from '../../infrastructure/firebase/firebase-admin.service';
import { MailerService } from '../../infrastructure/mailer/mailer.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { SocialProvider } from './dto/social-login.dto';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { SocialLinkConfirmTokenEntity } from './entities/social-link-confirm-token.entity';

const TEST_SECRET = 'unit-test-secret-that-is-at-least-32-chars-long';

describe('AuthService', () => {
  const userService = {
    findByEmail: jest.fn(),
    findByEmailWithHash: jest.fn(),
    findByIdWithHash: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    touchLastLogin: jest.fn(),
    updatePassword: jest.fn(),
    updateEmail: jest.fn(),
    markEmailVerified: jest.fn(),
    linkFacebookAccount: jest.fn(),
  };
  const mailer = { sendMail: jest.fn() };
  const firebaseAdmin = { verifyIdToken: jest.fn() };
  const refreshRepo = {
    findOne: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  const verificationRepo = {
    findOne: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  const resetRepo = {
    findOne: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  const socialLinkRepo = {
    findOne: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const map: Record<string, unknown> = {
        'jwt.secret': TEST_SECRET,
        'jwt.accessTtl': '900s',
        'jwt.refreshTtlDays': 30,
        'app.baseUrl': 'http://localhost:3000',
      };
      return key in map ? map[key] : fallback;
    }),
  };

  const user = {
    id: '1e8c4b7a-2f0d-4f0c-8e24-863eab0571b4',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Example',
    role: Role.USER,
    isEmailVerified: false,
    authProvider: AuthProvider.PASSWORD,
    facebookAccountId: null,
    createdAt: new Date(),
  };

  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: new JwtService({}) },
        { provide: ConfigService, useValue: config },
        { provide: MailerService, useValue: mailer },
        { provide: FirebaseAdminService, useValue: firebaseAdmin },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: refreshRepo,
        },
        {
          provide: getRepositoryToken(EmailVerificationTokenEntity),
          useValue: verificationRepo,
        },
        {
          provide: getRepositoryToken(PasswordResetTokenEntity),
          useValue: resetRepo,
        },
        {
          provide: getRepositoryToken(SocialLinkConfirmTokenEntity),
          useValue: socialLinkRepo,
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('signup', () => {
    it('creates a user with an Argon2id hash and issues tokens + verification mail', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(user);
      userService.findById.mockResolvedValue(user);

      const result = await service.signup({
        email: user.email,
        password: 'password123',
        firstName: user.firstName,
        lastName: user.lastName,
      });

      const created = userService.create.mock.calls[0][0];
      expect(created.passwordHash).not.toBe('password123');
      expect(await argon2.verify(created.passwordHash, 'password123')).toBe(
        true,
      );

      expect(verificationRepo.insert).toHaveBeenCalledTimes(1);
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      expect(result.user.email).toBe(user.email);
    });

    it('rejects duplicate emails', async () => {
      userService.findByEmail.mockResolvedValue(user);
      await expect(
        service.signup({
          email: user.email,
          password: 'password123',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(userService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('succeeds with a correct password', async () => {
      const passwordHash = await argon2.hash('password123');
      userService.findByEmailWithHash.mockResolvedValue({
        ...user,
        passwordHash,
      });
      userService.findById.mockResolvedValue(user);

      const result = await service.login({
        email: user.email,
        password: 'password123',
      });

      expect(userService.touchLastLogin).toHaveBeenCalledWith(user.id);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.user.email).toBe(user.email);
    });

    it('rejects an unknown email', async () => {
      userService.findByEmailWithHash.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await argon2.hash('password123');
      userService.findByEmailWithHash.mockResolvedValue({
        ...user,
        passwordHash,
      });
      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh token and revokes the old session', async () => {
      userService.findById.mockResolvedValue(user);
      const jwt = new JwtService({});
      const token = jwt.sign({}, { secret: TEST_SECRET, expiresIn: '30d' });

      refreshRepo.findOne.mockResolvedValueOnce({
        id: 'abc',
        userId: user.id,
        familyId: 'fam-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      const tokens = await service.refresh(token);

      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.refreshToken).not.toBe(token);
      expect(refreshRepo.update).toHaveBeenCalledWith('abc', expect.anything());
      expect(refreshRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown token', async () => {
      refreshRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('unknown-token')).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      expect(refreshRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      const jwt = new JwtService({});
      const token = jwt.sign({}, { secret: TEST_SECRET, expiresIn: '30d' });

      refreshRepo.findOne.mockResolvedValue({
        id: 'revoked-session',
        userId: user.id,
        familyId: 'fam-1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      await expect(service.refresh(token)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Refresh token reuse detected',
      });
      expect(refreshRepo.update).toHaveBeenCalledWith(
        { familyId: 'fam-1' },
        expect.anything(),
      );
    });

    it('rejects an expired refresh session', async () => {
      const jwt = new JwtService({});
      const token = jwt.sign({}, { secret: TEST_SECRET, expiresIn: '30d' });
      refreshRepo.findOne.mockResolvedValue({
        id: 'expired-session',
        userId: user.id,
        familyId: 'fam-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      expect(refreshRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('is single-use: the second attempt fails', async () => {
      verificationRepo.findOne.mockResolvedValue({
        id: 'vt',
        userId: user.id,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      await service.verifyEmail('some-token');
      expect(userService.markEmailVerified).toHaveBeenCalledWith(user.id);
      expect(verificationRepo.update).toHaveBeenCalledWith('vt', {
        consumedAt: expect.any(Date),
      });

      verificationRepo.findOne.mockResolvedValue({
        id: 'vt',
        userId: user.id,
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      await expect(service.verifyEmail('some-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('resetPassword', () => {
    it('consumes the token, updates the hash, and revokes all sessions', async () => {
      resetRepo.findOne.mockResolvedValue({
        id: 'rt',
        userId: user.id,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      });

      await service.resetPassword({
        token: 'reset-token',
        newPassword: 'newpassword123',
      });

      const [userId, hash] = userService.updatePassword.mock.calls[0];
      expect(userId).toBe(user.id);
      expect(await argon2.verify(hash, 'newpassword123')).toBe(true);
      expect(resetRepo.update).toHaveBeenCalledWith('rt', {
        consumedAt: expect.any(Date),
      });
      expect(refreshRepo.update).toHaveBeenCalledWith(
        { userId: user.id },
        expect.anything(),
      );
    });

    it('rejects an already-consumed token', async () => {
      resetRepo.findOne.mockResolvedValue({
        id: 'rt',
        userId: user.id,
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      await expect(
        service.resetPassword({
          token: 'reset-token',
          newPassword: 'newpassword123',
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('socialLogin', () => {
    const googleToken = {
      uid: 'firebase-uid-1',
      email: 'carol@gmail.com',
      email_verified: true,
      name: 'Carol Gmail',
      given_name: 'Carol',
      family_name: 'Gmail',
      firebase: { sign_in_provider: 'google.com' },
    };

    it('creates a new account from a verified Google token', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(googleToken);
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue({
        ...user,
        email: googleToken.email,
      });
      userService.findById.mockResolvedValue({
        ...user,
        email: googleToken.email,
        isEmailVerified: true,
      });

      const result = await service.socialLogin({
        provider: SocialProvider.GOOGLE,
        idToken: 'token-1',
      });

      const input = userService.create.mock.calls[0][0];
      expect(input.email).toBe('carol@gmail.com');
      expect(input.authProvider).toBe(AuthProvider.GOOGLE);
      expect(input.role).toBe(Role.USER);
      expect(input.firstName).toBe('Carol');
      expect(input.lastName).toBe('Gmail');
      expect(userService.markEmailVerified).toHaveBeenCalledWith(user.id);
      expect(userService.touchLastLogin).toHaveBeenCalledWith(user.id);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      expect(result.user.email).toBe('carol@gmail.com');
      expect(result.user.isEmailVerified).toBe(true);
    });

    it('links to an existing account without re-creating or re-verifying it', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(googleToken);
      userService.findByEmail.mockResolvedValue(user);

      const result = await service.socialLogin({
        provider: SocialProvider.GOOGLE,
        idToken: 'token-1',
      });

      expect(userService.create).not.toHaveBeenCalled();
      expect(userService.markEmailVerified).not.toHaveBeenCalled();
      expect(userService.touchLastLogin).toHaveBeenCalledWith(user.id);
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it('rejects a token whose provider does not match the request', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue({
        ...googleToken,
        firebase: { sign_in_provider: 'apple.com' },
      });

      await expect(
        service.socialLogin({
          provider: SocialProvider.GOOGLE,
          idToken: 'token-1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('rejects a token without a verified email claim', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue({
        ...googleToken,
        email_verified: false,
      });

      await expect(
        service.socialLogin({
          provider: SocialProvider.GOOGLE,
          idToken: 'token-1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid or expired ID token', async () => {
      firebaseAdmin.verifyIdToken.mockRejectedValue(
        new UnauthorizedError('Invalid or expired sign-in token'),
      );

      await expect(
        service.socialLogin({
          provider: SocialProvider.GOOGLE,
          idToken: 'expired-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('rejects when Firebase is not configured', async () => {
      firebaseAdmin.verifyIdToken.mockRejectedValue(
        new UnauthorizedError('Social login is not configured on this server'),
      );

      await expect(
        service.socialLogin({
          provider: SocialProvider.APPLE,
          idToken: 'any',
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('socialLogin facebook confirmation (Decision 4)', () => {
    const facebookToken = {
      uid: 'firebase-uid-fb',
      sub: 'firebase-uid-fb',
      email: 'carol@gmail.com',
      email_verified: true,
      name: 'Carol Facebook',
      given_name: 'Carol',
      family_name: 'Facebook',
      firebase: { sign_in_provider: 'facebook.com' },
    };

    it('creates a new account and links the Facebook identity immediately', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue({
        ...user,
        email: facebookToken.email,
        facebookAccountId: 'firebase-uid-fb',
      });
      userService.findById.mockResolvedValue({
        ...user,
        email: facebookToken.email,
        isEmailVerified: true,
        authProvider: AuthProvider.FACEBOOK,
        facebookAccountId: 'firebase-uid-fb',
      });

      const result = await service.socialLogin({
        provider: SocialProvider.FACEBOOK,
        idToken: 'token-fb-1',
      });

      const input = userService.create.mock.calls[0][0];
      expect(input.authProvider).toBe(AuthProvider.FACEBOOK);
      expect(input.facebookAccountId).toBe('firebase-uid-fb');
      expect(userService.markEmailVerified).toHaveBeenCalledWith(user.id);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.user.authProvider).toBe(AuthProvider.FACEBOOK);
    });

    it('logs in when the Facebook identity was already confirmed', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
      userService.findByEmail.mockResolvedValue({
        ...user,
        email: facebookToken.email,
        facebookAccountId: 'firebase-uid-fb',
      });

      const result = await service.socialLogin({
        provider: SocialProvider.FACEBOOK,
        idToken: 'token-fb-2',
      });

      expect(userService.create).not.toHaveBeenCalled();
      expect(userService.touchLastLogin).toHaveBeenCalledWith(user.id);
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it('requires confirmation instead of silently linking an existing password account', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
      userService.findByEmail.mockResolvedValue({
        ...user,
        email: facebookToken.email,
        authProvider: AuthProvider.PASSWORD,
        facebookAccountId: null,
      });

      await expect(
        service.socialLogin({
          provider: SocialProvider.FACEBOOK,
          idToken: 'token-fb-3',
        }),
      ).rejects.toBeInstanceOf(SocialLinkConfirmationRequiredError);

      try {
        await service.socialLogin({
          provider: SocialProvider.FACEBOOK,
          idToken: 'token-fb-3',
        });
      } catch (e) {
        expect((e as SocialLinkConfirmationRequiredError).details).toEqual({
          email: facebookToken.email,
          provider: 'facebook',
          hasPassword: true,
        });
      }
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('requires confirmation for a passwordless account and reports hasPassword false', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
      userService.findByEmail.mockResolvedValue({
        ...user,
        email: facebookToken.email,
        authProvider: AuthProvider.GOOGLE,
        facebookAccountId: null,
      });

      await expect(
        service.socialLogin({
          provider: SocialProvider.FACEBOOK,
          idToken: 'token-fb-4',
        }),
      ).rejects.toMatchObject({
        code: 'SOCIAL_LINK_CONFIRMATION_REQUIRED',
        details: { hasPassword: false },
      });
    });

    it('requires confirmation when a different Facebook identity is linked', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
      userService.findByEmail.mockResolvedValue({
        ...user,
        email: facebookToken.email,
        facebookAccountId: 'some-other-sub',
      });

      await expect(
        service.socialLogin({
          provider: SocialProvider.FACEBOOK,
          idToken: 'token-fb-5',
        }),
      ).rejects.toBeInstanceOf(SocialLinkConfirmationRequiredError);
    });
  });

  describe('social link confirmation', () => {
    const facebookToken = {
      uid: 'firebase-uid-fb',
      sub: 'firebase-uid-fb',
      email: 'alice@example.com',
      email_verified: true,
      name: 'Alice Facebook',
      firebase: { sign_in_provider: 'facebook.com' },
    };

    describe('confirmSocialLinkPassword', () => {
      it('links the Facebook identity and issues tokens when the password matches', async () => {
        firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
        userService.findByEmailWithHash.mockResolvedValue({
          ...user,
          passwordHash: await argon2.hash('password123'),
        });

        const result = await service.confirmSocialLinkPassword({
          idToken: 'token-fb',
          password: 'password123',
        });

        expect(userService.linkFacebookAccount).toHaveBeenCalledWith(
          user.id,
          'firebase-uid-fb',
        );
        expect(userService.touchLastLogin).toHaveBeenCalledWith(user.id);
        expect(result.tokens.accessToken).toBeTruthy();
        expect(result.tokens.refreshToken).toBeTruthy();
      });

      it('rejects a wrong password without linking', async () => {
        firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
        userService.findByEmailWithHash.mockResolvedValue({
          ...user,
          passwordHash: await argon2.hash('password123'),
        });

        await expect(
          service.confirmSocialLinkPassword({
            idToken: 'token-fb',
            password: 'wrong-password',
          }),
        ).rejects.toBeInstanceOf(UnauthorizedError);
        expect(userService.linkFacebookAccount).not.toHaveBeenCalled();
      });

      it('rejects a token that is not a Facebook sign-in', async () => {
        firebaseAdmin.verifyIdToken.mockResolvedValue({
          ...facebookToken,
          firebase: { sign_in_provider: 'google.com' },
        });

        await expect(
          service.confirmSocialLinkPassword({
            idToken: 'token-google',
            password: 'password123',
          }),
        ).rejects.toBeInstanceOf(UnauthorizedError);
        expect(userService.findByEmailWithHash).not.toHaveBeenCalled();
      });
    });

    describe('requestSocialLinkConfirmation', () => {
      it('emails a confirmation link to a passwordless account', async () => {
        firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
        userService.findByEmail.mockResolvedValue({
          ...user,
          authProvider: AuthProvider.GOOGLE,
        });

        await service.requestSocialLinkConfirmation({ idToken: 'token-fb' });

        expect(socialLinkRepo.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: user.id,
            provider: 'facebook',
            providerAccountId: 'firebase-uid-fb',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        );
        expect(mailer.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({ to: user.email }),
        );
      });

      it('requires the password path for accounts that have a password', async () => {
        firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
        userService.findByEmail.mockResolvedValue({
          ...user,
          authProvider: AuthProvider.PASSWORD,
        });

        await expect(
          service.requestSocialLinkConfirmation({ idToken: 'token-fb' }),
        ).rejects.toMatchObject({ code: 'BUSINESS_VALIDATION_ERROR' });
        expect(socialLinkRepo.insert).not.toHaveBeenCalled();
        expect(mailer.sendMail).not.toHaveBeenCalled();
      });

      it('rejects when no account matches the verified email', async () => {
        firebaseAdmin.verifyIdToken.mockResolvedValue(facebookToken);
        userService.findByEmail.mockResolvedValue(null);

        await expect(
          service.requestSocialLinkConfirmation({ idToken: 'token-fb' }),
        ).rejects.toMatchObject({ code: 'CONFLICT' });
        expect(socialLinkRepo.insert).not.toHaveBeenCalled();
      });
    });

    describe('confirmSocialLinkEmail', () => {
      it('links the pending identity and consumes the token', async () => {
        socialLinkRepo.findOne.mockResolvedValue({
          id: 'confirm-1',
          userId: user.id,
          providerAccountId: 'firebase-uid-fb',
          expiresAt: new Date(Date.now() + 3_600_000),
          consumedAt: null,
        });

        const result = await service.confirmSocialLinkEmail({
          token: 'raw-token',
        });

        expect(userService.linkFacebookAccount).toHaveBeenCalledWith(
          user.id,
          'firebase-uid-fb',
        );
        expect(socialLinkRepo.update).toHaveBeenCalledWith('confirm-1', {
          consumedAt: expect.any(Date),
        });
        expect(result.message).toContain('linked');
      });

      it('rejects an unknown token', async () => {
        socialLinkRepo.findOne.mockResolvedValue(null);
        await expect(
          service.confirmSocialLinkEmail({ token: 'raw-token' }),
        ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(userService.linkFacebookAccount).not.toHaveBeenCalled();
      });

      it('rejects an already-consumed token', async () => {
        socialLinkRepo.findOne.mockResolvedValue({
          id: 'confirm-1',
          userId: user.id,
          providerAccountId: 'firebase-uid-fb',
          expiresAt: new Date(Date.now() + 3_600_000),
          consumedAt: new Date(),
        });

        await expect(
          service.confirmSocialLinkEmail({ token: 'raw-token' }),
        ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(userService.linkFacebookAccount).not.toHaveBeenCalled();
      });

      it('rejects an expired token', async () => {
        socialLinkRepo.findOne.mockResolvedValue({
          id: 'confirm-1',
          userId: user.id,
          providerAccountId: 'firebase-uid-fb',
          expiresAt: new Date(Date.now() - 1),
          consumedAt: null,
        });

        await expect(
          service.confirmSocialLinkEmail({ token: 'raw-token' }),
        ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(userService.linkFacebookAccount).not.toHaveBeenCalled();
      });
    });
  });

  describe('logout', () => {
    it('revokes a session owned by the caller', async () => {
      refreshRepo.findOne.mockResolvedValue({
        id: 's1',
        userId: user.id,
        isRevoked: false,
      });
      const jwt = new JwtService({});
      const token = jwt.sign({}, { secret: TEST_SECRET, expiresIn: '30d' });

      await service.logout(user.id, token);

      expect(refreshRepo.update).toHaveBeenCalledWith('s1', expect.anything());
    });

    it('refuses to revoke another users session', async () => {
      refreshRepo.findOne.mockResolvedValue({
        id: 's1',
        userId: 'someone-else',
        isRevoked: false,
      });
      const jwt = new JwtService({});
      const token = jwt.sign({}, { secret: TEST_SECRET, expiresIn: '30d' });

      await expect(service.logout(user.id, token)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      expect(refreshRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('verifies the current password, updates the hash, and revokes sessions', async () => {
      const passwordHash = await argon2.hash('currentpassword1');
      userService.findByIdWithHash.mockResolvedValue({
        ...user,
        passwordHash,
      });

      await service.changePassword(
        user.id,
        'currentpassword1',
        'newpassword123',
      );

      const [userId, hash] = userService.updatePassword.mock.calls[0];
      expect(userId).toBe(user.id);
      expect(await argon2.verify(hash, 'newpassword123')).toBe(true);
      expect(refreshRepo.update).toHaveBeenCalledWith(
        { userId: user.id },
        expect.anything(),
      );
    });

    it('rejects a wrong current password', async () => {
      const passwordHash = await argon2.hash('currentpassword1');
      userService.findByIdWithHash.mockResolvedValue({
        ...user,
        passwordHash,
      });

      await expect(
        service.changePassword(user.id, 'wrong-password', 'newpassword123'),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(userService.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects an unknown user', async () => {
      userService.findByIdWithHash.mockResolvedValue(null);
      await expect(
        service.changePassword(user.id, 'currentpassword1', 'newpassword123'),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(userService.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('changeEmail', () => {
    it('verifies the password, updates the email, and issues re-verification', async () => {
      const passwordHash = await argon2.hash('currentpassword1');
      userService.findByIdWithHash.mockResolvedValue({
        ...user,
        passwordHash,
      });
      userService.findByEmail.mockResolvedValue(null);

      await service.changeEmail(
        user.id,
        'alice.new@example.com',
        'currentpassword1',
      );

      expect(userService.updateEmail).toHaveBeenCalledWith(
        user.id,
        'alice.new@example.com',
      );
      expect(verificationRepo.insert).toHaveBeenCalledTimes(1);
      expect(mailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice.new@example.com' }),
      );
    });

    it('rejects an email already in use by another account', async () => {
      const passwordHash = await argon2.hash('currentpassword1');
      userService.findByIdWithHash.mockResolvedValue({
        ...user,
        passwordHash,
      });
      userService.findByEmail.mockResolvedValue({
        id: 'someone-else',
        email: 'alice.new@example.com',
      });

      await expect(
        service.changeEmail(
          user.id,
          'alice.new@example.com',
          'currentpassword1',
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(userService.updateEmail).not.toHaveBeenCalled();
      expect(verificationRepo.insert).not.toHaveBeenCalled();
    });

    it('rejects a wrong current password', async () => {
      const passwordHash = await argon2.hash('currentpassword1');
      userService.findByIdWithHash.mockResolvedValue({
        ...user,
        passwordHash,
      });

      await expect(
        service.changeEmail(user.id, 'alice.new@example.com', 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(userService.updateEmail).not.toHaveBeenCalled();
    });
  });
});
