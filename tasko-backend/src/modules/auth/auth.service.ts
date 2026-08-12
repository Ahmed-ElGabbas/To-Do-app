import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import type { StringValue } from 'ms';
import { Repository } from 'typeorm';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  SocialLinkConfirmationRequiredError,
} from '../../common/errors/domain-error';
import { Role } from '../../common/constants/role.enum';
import { AuthProvider } from '../../common/constants/auth-provider.enum';
import { MailerService } from '../../infrastructure/mailer/mailer.service';
import { FirebaseAdminService } from '../../infrastructure/firebase/firebase-admin.service';
import { UserService } from '../user/user.service';
import { UserEntity } from '../user/entities/user.entity';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { SocialLinkConfirmTokenEntity } from './entities/social-link-confirm-token.entity';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { SocialLinkConfirmEmailDto } from './dto/social-link-confirm-email.dto';
import { SocialLinkConfirmPasswordDto } from './dto/social-link-confirm-password.dto';
import { SocialLinkConfirmRequestDto } from './dto/social-link-confirm-request.dto';
import { SocialLoginDto, SocialProvider } from './dto/social-login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
  authProvider: AuthProvider;
  createdAt: Date;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const SOCIAL_LINK_CONFIRM_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Maps a requested social provider to its Firebase `sign_in_provider` value. */
const SIGN_IN_PROVIDER: Record<SocialProvider, string> = {
  [SocialProvider.GOOGLE]: 'google.com',
  [SocialProvider.APPLE]: 'apple.com',
  [SocialProvider.FACEBOOK]: 'facebook.com',
};

/** Maps a requested social provider to the persisted `auth_provider` value. */
const AUTH_PROVIDER_BY_SOCIAL: Record<SocialProvider, AuthProvider> = {
  [SocialProvider.GOOGLE]: AuthProvider.GOOGLE,
  [SocialProvider.APPLE]: AuthProvider.APPLE,
  [SocialProvider.FACEBOOK]: AuthProvider.FACEBOOK,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    private readonly firebaseAdmin: FirebaseAdminService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshRepo: Repository<RefreshTokenEntity>,
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly verificationRepo: Repository<EmailVerificationTokenEntity>,
    @InjectRepository(PasswordResetTokenEntity)
    private readonly resetRepo: Repository<PasswordResetTokenEntity>,
    @InjectRepository(SocialLinkConfirmTokenEntity)
    private readonly socialLinkRepo: Repository<SocialLinkConfirmTokenEntity>,
  ) {}

  /**
   * Signs in with a Firebase-verified social identity. The ID token is
   * verified server-side, its `sign_in_provider` is matched against the
   * requested provider, and a verified email is required. The account is then
   * found-or-created and the same token pair as a password login is issued.
   * New accounts get `authProvider` set and email marked verified; existing
   * accounts simply log in (their provider column is never overwritten).
   *
   * Facebook is the exception (Decision 4): a Facebook sign-in whose verified
   * email matches an existing account is NOT logged in silently. If the
   * account has already confirmed that Facebook identity
   * (`facebook_account_id` matches the token's subject) it logs in normally;
   * otherwise it throws `SocialLinkConfirmationRequiredError` and the client
   * must prove ownership (password or emailed link) before linking. A
   * duplicate account is never created for an existing email.
   */
  async socialLogin(
    dto: SocialLoginDto,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const decoded = await this.firebaseAdmin.verifyIdToken(dto.idToken);

    if (decoded.firebase?.sign_in_provider !== SIGN_IN_PROVIDER[dto.provider]) {
      throw new UnauthorizedError(
        'Token provider does not match the requested social provider',
      );
    }
    if (!decoded.email || !decoded.email_verified) {
      throw new UnauthorizedError(
        'The social account has no verified email address',
      );
    }

    const email = decoded.email.trim().toLowerCase();
    let user = await this.userService.findByEmail(email);

    if (!user) {
      user = await this.userService.create({
        email,
        passwordHash: await argon2.hash(randomBytes(24).toString('base64url')),
        firstName: decoded.given_name ?? decoded.name?.split(' ')[0] ?? '',
        lastName:
          decoded.family_name ??
          decoded.name?.split(' ').slice(1).join(' ') ??
          '',
        role: Role.USER,
        authProvider: AUTH_PROVIDER_BY_SOCIAL[dto.provider],
        ...(dto.provider === SocialProvider.FACEBOOK
          ? { facebookAccountId: this.providerAccountIdOf(decoded) }
          : {}),
      });
      await this.userService.markEmailVerified(user.id);
      user = (await this.userService.findById(user.id))!;
    } else if (
      dto.provider === SocialProvider.FACEBOOK &&
      user.facebookAccountId !== this.providerAccountIdOf(decoded)
    ) {
      throw new SocialLinkConfirmationRequiredError(
        email,
        user.authProvider === AuthProvider.PASSWORD,
      );
    }

    await this.userService.touchLastLogin(user.id);
    const tokens = await this.issueTokens(user.id);
    return { user: this.toPublic(user), tokens };
  }

  /**
   * Confirms a Facebook link to an existing password account by re-entering
   * its password, then links the identity and issues tokens. The account is
   * identified by the verified email in the Facebook ID token, never by
   * client-supplied fields.
   */
  async confirmSocialLinkPassword(
    dto: SocialLinkConfirmPasswordDto,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const decoded = await this.verifyFacebookToken(dto.idToken);
    const user = await this.userService.findByEmailWithHash(decoded.email!);
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.userService.linkFacebookAccount(
      user.id,
      this.providerAccountIdOf(decoded),
    );
    await this.userService.touchLastLogin(user.id);
    const tokens = await this.issueTokens(user.id);
    return { user: this.toPublic(user), tokens };
  }

  /**
   * Emails a one-time confirmation link to a passwordless account whose email
   * a Facebook sign-in matched (Google/Apple-created accounts have no usable
   * password, so password proof is impossible). Password accounts must use
   * [confirmSocialLinkPassword] instead. The emailed link binds the Facebook
   * identity that was verified in this request.
   */
  async requestSocialLinkConfirmation(
    dto: SocialLinkConfirmRequestDto,
  ): Promise<{ message: string }> {
    const decoded = await this.verifyFacebookToken(dto.idToken);
    const user = await this.userService.findByEmail(decoded.email!);
    if (!user) {
      throw new ConflictError('No account with this email exists');
    }
    if (user.authProvider === AuthProvider.PASSWORD) {
      throw new ValidationError(
        'This account uses a password. Confirm by entering it instead.',
      );
    }

    const rawToken = randomBytes(32).toString('base64url');
    await this.socialLinkRepo.insert({
      userId: user.id,
      tokenHash: this.hashToken(rawToken),
      provider: 'facebook',
      providerAccountId: this.providerAccountIdOf(decoded),
      expiresAt: new Date(Date.now() + SOCIAL_LINK_CONFIRM_TOKEN_TTL_MS),
    });
    await this.mailer.sendMail({
      to: user.email,
      subject: 'Confirm linking your Facebook account',
      html: this.socialLinkConfirmHtml(rawToken),
    });

    return {
      message:
        'A confirmation link has been sent to your email. Click it, then sign in with Facebook again.',
    };
  }

  /**
   * Completes a Facebook link from the emailed one-time token. Persists the
   * identity recorded when the token was issued, then consumes it. Tokens are
   * not issued here — the user returns to the app and signs in with Facebook,
   * which then succeeds because the link is recorded.
   */
  async confirmSocialLinkEmail(
    dto: SocialLinkConfirmEmailDto,
  ): Promise<{ message: string }> {
    const record = await this.socialLinkRepo.findOne({
      where: { tokenHash: this.hashToken(dto.token) },
    });
    if (!record) {
      throw new UnauthorizedError('Invalid confirmation token');
    }
    if (record.consumedAt) {
      throw new UnauthorizedError('Confirmation token has already been used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Confirmation token has expired');
    }

    await this.userService.linkFacebookAccount(
      record.userId,
      record.providerAccountId,
    );
    await this.socialLinkRepo.update(record.id, { consumedAt: new Date() });

    return {
      message: 'Facebook account linked. You can now sign in with Facebook.',
    };
  }

  async signup(
    dto: SignupDto,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.userService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: Role.USER,
    });

    await this.issueVerificationToken(user.id, user.email);
    const tokens = await this.issueTokens(user.id);

    return { user: this.toPublic(user), tokens };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const user = await this.userService.findByEmailWithHash(dto.email);
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.userService.touchLastLogin(user.id);
    const tokens = await this.issueTokens(user.id);

    return { user: this.toPublic(user), tokens };
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const record = await this.refreshRepo.findOne({
      where: { tokenHash: this.hashToken(rawRefreshToken) },
    });
    if (!record) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (record.isRevoked) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedError('Refresh token reuse detected');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    await this.revokeRecord(record.id);
    const newRawRefreshToken = this.createRefreshToken();
    await this.insertRefreshSession(
      record.userId,
      record.familyId,
      newRawRefreshToken,
    );

    const accessToken = await this.createAccessToken(record.userId);
    return { accessToken, refreshToken: newRawRefreshToken };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const record = await this.verificationRepo.findOne({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record) {
      throw new UnauthorizedError('Invalid verification token');
    }
    if (record.consumedAt) {
      throw new UnauthorizedError('Verification token has already been used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Verification token has expired');
    }

    await this.verificationRepo.update(record.id, { consumedAt: new Date() });
    await this.userService.markEmailVerified(record.userId);
    return { message: 'Email verified' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);
    if (user) {
      const rawToken = randomBytes(32).toString('base64url');
      await this.resetRepo.insert({
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
      await this.mailer.sendMail({
        to: user.email,
        subject: 'Reset your Tasko password',
        html: this.resetPasswordHtml(rawToken),
      });
    }
    return {
      message:
        'If an account exists for that email, a reset link has been sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = await this.resetRepo.findOne({
      where: { tokenHash: this.hashToken(dto.token) },
    });
    if (!record) {
      throw new UnauthorizedError('Invalid reset token');
    }
    if (record.consumedAt) {
      throw new UnauthorizedError('Reset token has already been used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Reset token has expired');
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.userService.updatePassword(record.userId, passwordHash);
    await this.resetRepo.update(record.id, { consumedAt: new Date() });
    await this.revokeAllSessions(record.userId);

    return { message: 'Password updated. All sessions have been revoked.' };
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const record = await this.refreshRepo.findOne({
      where: { tokenHash: this.hashToken(rawRefreshToken) },
    });
    if (!record) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (record.userId !== userId) {
      throw new UnauthorizedError('Cannot revoke another session');
    }
    if (!record.isRevoked) {
      await this.revokeRecord(record.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllSessions(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByIdWithHash(userId);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.userService.updatePassword(userId, passwordHash);
    await this.revokeAllSessions(userId);

    return {
      message: 'Password updated. All other sessions have been signed out.',
    };
  }

  async changeEmail(
    userId: string,
    newEmail: string,
    currentPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByIdWithHash(userId);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const existing = await this.userService.findByEmail(newEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictError('An account with this email already exists');
    }

    await this.userService.updateEmail(userId, newEmail);
    await this.issueVerificationToken(userId, newEmail);

    return {
      message:
        'Email updated. A verification link has been sent to the new address.',
    };
  }

  async profile(userId: string): Promise<PublicUser> {
    const user = await this.userService.findById(userId);
    return this.toPublic(user);
  }

  private async issueVerificationToken(
    userId: string,
    email: string,
  ): Promise<void> {
    const rawToken = randomBytes(32).toString('base64url');
    await this.verificationRepo.insert({
      userId,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });
    await this.mailer.sendMail({
      to: email,
      subject: 'Verify your Tasko email',
      html: this.verificationHtml(rawToken),
    });
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const refreshToken = this.createRefreshToken();
    await this.insertRefreshSession(userId, randomUUID(), refreshToken);
    const accessToken = await this.createAccessToken(userId);
    return { accessToken, refreshToken };
  }

  private async createAccessToken(userId: string): Promise<string> {
    const user = await this.userService.findById(userId);
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.getJwtSecret(),
        expiresIn: this.config.get<string>(
          'jwt.accessTtl',
          '900s',
        ) as StringValue,
      },
    );
  }

  private createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private async insertRefreshSession(
    userId: string,
    familyId: string,
    rawRefreshToken: string,
  ): Promise<void> {
    await this.refreshRepo.insert({
      userId,
      familyId,
      tokenHash: this.hashToken(rawRefreshToken),
      expiresAt: new Date(
        Date.now() +
          (this.config.get<number>('jwt.refreshTtlDays') ?? 30) * 86_400_000,
      ),
    });
  }

  private async revokeRecord(id: string): Promise<void> {
    await this.refreshRepo.update(id, {
      isRevoked: true,
      revokedAt: new Date(),
    });
  }

  /** Reuse of a rotated token is a theft signal: kill the entire family. */
  private async revokeFamily(familyId: string): Promise<void> {
    await this.refreshRepo.update(
      { familyId },
      { isRevoked: true, revokedAt: new Date() },
    );
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.refreshRepo.update(
      { userId },
      { isRevoked: true, revokedAt: new Date() },
    );
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Verifies a token was issued for a Facebook sign-in with a verified email
   * and returns its claims. Reused by the confirmation endpoints so the link
   * always binds the identity that the user actually signed in with.
   */
  private async verifyFacebookToken(
    idToken: string,
  ): Promise<Awaited<ReturnType<FirebaseAdminService['verifyIdToken']>>> {
    const decoded = await this.firebaseAdmin.verifyIdToken(idToken);
    if (decoded.firebase?.sign_in_provider !== 'facebook.com') {
      throw new UnauthorizedError(
        'The token was not issued for Facebook sign-in',
      );
    }
    if (!decoded.email || !decoded.email_verified) {
      throw new UnauthorizedError(
        'The Facebook account has no verified email address',
      );
    }
    return decoded;
  }

  /** Stable per-user identity inside the Firebase project (the UID). */
  private providerAccountIdOf(
    decoded: Awaited<ReturnType<FirebaseAdminService['verifyIdToken']>>,
  ): string {
    const id = decoded.sub ?? decoded.uid;
    if (!id) {
      throw new UnauthorizedError('The sign-in token carries no user identity');
    }
    return id;
  }

  private getJwtSecret(): string {
    return this.config.get<string>('jwt.secret', '');
  }

  private toPublic(user: UserEntity): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
    };
  }

  private verificationHtml(rawToken: string): string {
    const link = `${this.config.get<string>('app.baseUrl')}/verify-email?token=${encodeURIComponent(rawToken)}`;
    return `<p>Verify your Tasko email by following this link:</p><a href="${link}">Verify email</a>`;
  }

  private resetPasswordHtml(rawToken: string): string {
    const link = `${this.config.get<string>('app.baseUrl')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    return `<p>Reset your Tasko password by following this link (valid for 1 hour):</p><a href="${link}">Reset password</a>`;
  }

  private socialLinkConfirmHtml(rawToken: string): string {
    const link = `${this.config.get<string>('app.baseUrl')}/confirm-social-link?token=${encodeURIComponent(rawToken)}`;
    return `<p>Someone tried to sign in to a Tasko account with a Facebook account matching your email. If this was you, confirm the link by following this link (valid for 1 hour):</p><a href="${link}">Confirm Facebook link</a><p>If you did not request this, you can safely ignore this email.</p>`;
  }
}
