import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { UnauthorizedError } from '../../common/errors/domain-error';
import { Role } from '../../common/constants/role.enum';
import { MailerService } from '../../infrastructure/mailer/mailer.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

const TEST_SECRET = 'unit-test-secret-that-is-at-least-32-chars-long';

describe('AuthService', () => {
  const userService = {
    findByEmail: jest.fn(),
    findByEmailWithHash: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    touchLastLogin: jest.fn(),
    updatePassword: jest.fn(),
    markEmailVerified: jest.fn(),
  };
  const mailer = { sendMail: jest.fn() };
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
});
