import { TeamRole } from '../constants/team-role.enum';

/**
 * The caller's membership in the team of the current request, resolved by
 * TeamMembershipGuard and stored on the request for downstream decorators.
 */
export interface TeamMembershipContext {
  teamId: string;
  userId: string;
  role: TeamRole;
}

/** Team-scoped context attached to the request by TeamMembershipGuard. */
export interface TeamContext {
  teamId: string;
  membership: TeamMembershipContext;
}
