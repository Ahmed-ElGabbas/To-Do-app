import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamRole } from '../constants/team-role.enum';
import { REQUIRE_TEAM_ROLE_KEY } from '../decorators/require-team-role.decorator';
import {
  ForbiddenActionError,
  UnauthorizedError,
} from '../errors/domain-error';
import { TeamContext, TeamMembershipContext } from '../types/team-context';
import { MemberRepository } from '../../modules/member/interfaces/member-repository';

const ROLE_RANK: Record<TeamRole, number> = {
  [TeamRole.VIEWER]: 0,
  [TeamRole.EDITOR]: 1,
  [TeamRole.OWNER]: 2,
};

/**
 * Team-scoped authorization guard. Only routes marked with `@RequireTeamRole`
 * are checked; everything else passes through untouched (mirrors how the
 * global JwtAuthGuard / RolesGuard skip unannotated routes).
 *
 * Roles are hierarchical and `@RequireTeamRole(...roles)` is a union: the
 * caller passes if they hold ANY listed role (or a higher one). For a checked
 * route the guard:
 *  1. resolves the team id from the `:teamId` path parameter,
 *  2. loads the caller's membership (403 if they are not a member),
 *  3. enforces the required team role (403 if the role is too low),
 *  4. attaches the team context for @CurrentTeam()/@CurrentMembership().
 */
@Injectable()
export class TeamMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: MemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TeamRole[]>(
      REQUIRE_TEAM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string } | undefined;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const teamId: string | undefined = request.params?.teamId;
    if (!teamId) {
      throw new ForbiddenActionError('Missing team context');
    }

    const membership = await this.members.findByTeamAndUser(teamId, user.id);
    if (!membership) {
      throw new ForbiddenActionError('You are not a member of this team');
    }

    if (requiredRoles.length > 0) {
      const rank = ROLE_RANK[membership.role];
      const minRequiredRank = Math.min(
        ...requiredRoles.map((role) => ROLE_RANK[role]),
      );
      if (rank < minRequiredRank) {
        throw new ForbiddenActionError(
          'You do not have the required team role',
        );
      }
    }

    const teamMembership: TeamMembershipContext = {
      teamId,
      userId: user.id,
      role: membership.role,
    };
    const teamContext: TeamContext = {
      teamId,
      membership: teamMembership,
    };
    request.teamMembership = teamMembership;
    request.teamContext = teamContext;
    return true;
  }
}
