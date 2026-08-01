import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TeamContext } from '../types/team-context';

/** Injects the team context set by TeamMembershipGuard (teamId + membership). */
export const CurrentTeam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TeamContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.teamContext as TeamContext;
  },
);
