import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

/** Social identity providers accepted by POST /auth/social-login. */
export enum SocialProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
  FACEBOOK = 'facebook',
}

export class SocialLoginDto {
  /**
   * Firebase ID token produced by the client SDK. The server verifies it
   * against the configured Firebase project before trusting its claims.
   */
  @IsString()
  @IsNotEmpty()
  idToken: string;

  /** The provider the client attempted to sign in with. */
  @IsEnum(SocialProvider)
  provider: SocialProvider;
}
