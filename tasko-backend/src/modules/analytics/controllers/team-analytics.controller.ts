import { Controller, Get, Param } from '@nestjs/common';
import { RequireTeamRole } from '../../../common/decorators/require-team-role.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import { AnalyticsService } from '../services/analytics.service';

/**
 * Team-scoped analytics. Any team member may read; the global
 * TeamMembershipGuard resolves the caller's role.
 */
@Controller('teams/:teamId/analytics')
export class TeamAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @RequireTeamRole()
  summary(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.analytics.team(teamId);
  }
}
