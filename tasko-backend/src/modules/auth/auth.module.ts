import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '../../infrastructure/mailer/mailer.module';
import { FirebaseModule } from '../../infrastructure/firebase/firebase.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { SocialLinkConfirmTokenEntity } from './entities/social-link-confirm-token.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UserModule,
    MailerModule,
    FirebaseModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      RefreshTokenEntity,
      EmailVerificationTokenEntity,
      PasswordResetTokenEntity,
      SocialLinkConfirmTokenEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
