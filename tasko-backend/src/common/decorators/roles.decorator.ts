import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/role.enum';

export const ROLES_KEY = 'roles';

/** Restricts a route to callers whose role is included in `roles`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
