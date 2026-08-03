import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { TeamRole } from '../../../common/constants/team-role.enum';

/** Invites a person to a team by e-mail with an optional target role. */
export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole;
}
