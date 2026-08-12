import { IsNotEmpty, IsString } from 'class-validator';

/** Completes a Facebook account link using the one-time emailed token. */
export class SocialLinkConfirmEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
