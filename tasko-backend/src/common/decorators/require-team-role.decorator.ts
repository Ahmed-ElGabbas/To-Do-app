import { SetMetadata } from '@nestjs/common';
import { TeamRole } from '../constants/team-role.enum';

export const REQUIRE_TEAM_ROLE_KEY = 'requireTeamRole';

/**
 * Opts a route into team-scoped authorization. Must be used on a route that
 * carries a `:teamId` path parameter.
 *
 * Roles are hierarchical: the caller must hold one of `roles` (or higher).
 * With no arguments every team member is allowed. Routes without this
 * decorator are not team-scoped and are skipped by TeamMembershipGuard.
 */
export const RequireTeamRole = (...roles: TeamRole[]) =>
  SetMetadata(REQUIRE_TEAM_ROLE_KEY, roles);
