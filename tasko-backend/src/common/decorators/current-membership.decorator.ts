import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TeamMembershipContext } from '../types/team-context';

/** Injects the caller's membership set by TeamMembershipGuard. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TeamMembershipContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.teamMembership as TeamMembershipContext;
  },
);
