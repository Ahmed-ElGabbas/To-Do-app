import { Role } from '../../../common/constants/role.enum';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamOutput } from '../../team/dto/team.output';

/** Platform-wide counters for the admin overview. */
export interface AdminStatsOutput {
  totalUsers: number;
  totalTeams: number;
  totalTasks: number;
  completedTasks: number;
}

/** A user as shown in admin listings. */
export interface AdminUserOutput {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A team in the admin listing, annotated with its member count. */
export interface AdminTeamOutput extends TeamOutput {
  memberCount: number;
}

/** One membership within the admin team-detail view. */
export interface AdminTeamMemberOutput {
  memberId: string;
  userId: string;
  role: TeamRole;
  email: string;
  firstName: string;
  lastName: string;
}

/** Full admin view of a single team: its profile plus members. */
export interface AdminTeamDetailOutput {
  team: TeamOutput;
  members: AdminTeamMemberOutput[];
}
