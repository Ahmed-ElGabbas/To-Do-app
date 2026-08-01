import { IsEnum } from 'class-validator';
import { TeamRole } from '../../../common/constants/team-role.enum';

export class ChangeMemberRoleDto {
  @IsEnum(TeamRole)
  role: TeamRole;
}
