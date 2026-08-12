import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Confirms that the holder of a Facebook ID token also owns the existing
 * account whose email the token matched, by re-entering that account's
 * password. On success the Facebook identity is linked and tokens issued.
 */
export class SocialLinkConfirmPasswordDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
