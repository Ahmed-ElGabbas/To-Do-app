import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Accepting a magic-link invitation. `firstName`/`lastName` are only used when
 * the invited e-mail has no account yet (the accept then completes a stub
 * registration); existing accounts are linked directly and ignore these.
 */
export class AcceptInvitationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
