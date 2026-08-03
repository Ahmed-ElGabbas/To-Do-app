import { IsEnum } from 'class-validator';
import { Role } from '../../../common/constants/role.enum';

/** Admin: changes a user's system-wide role. */
export class UpdateUserRoleDto {
  @IsEnum(Role)
  role: Role;
}
