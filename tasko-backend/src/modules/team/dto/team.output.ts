import { TeamRole } from '../../../common/constants/team-role.enum';

/** Response shape for a team. Whitelisted by construction in TeamService. */
export interface TeamOutput {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A team as returned by "GET /teams", annotated with the caller's role. */
export interface TeamWithRoleOutput extends TeamOutput {
  role: TeamRole;
}
