import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Requests an email confirmation link for a Facebook sign-in that matched an
 * existing passwordless account. The link (sent to the matched account's
 * verified email) persists the Facebook identity once clicked.
 */
export class SocialLinkConfirmRequestDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
