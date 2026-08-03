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
} from '../../common/errors/domain-error';
import { Role } from '../../common/constants/role.enum';
import { MailerService } from '../../infrastructure/mailer/mailer.service';
import { UserService } from '../user/user.service';
import { UserEntity } from '../user/entities/user.entity';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';

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
  createdAt: Date;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshRepo: Repository<RefreshTokenEntity>,
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly verificationRepo: Repository<EmailVerificationTokenEntity>,
    @InjectRepository(PasswordResetTokenEntity)
    private readonly resetRepo: Repository<PasswordResetTokenEntity>,
  ) {}

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
}
