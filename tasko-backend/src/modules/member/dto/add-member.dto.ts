import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TeamRole } from '../../../common/constants/team-role.enum';

/** Adds an existing registered user to a team by email. */
export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole;
}
