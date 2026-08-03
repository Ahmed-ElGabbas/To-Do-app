import { Role } from '../../../common/constants/role.enum';
import { UserEntity } from '../entities/user.entity';

/** Whitelisted public form of a user, safe to return over the API. */
export class UserOutput {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
  avatarFileId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserOutput(user: UserEntity): UserOutput {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    avatarFileId: user.avatarFileId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
