import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireTeamRole } from '../../../common/decorators/require-team-role.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import { AnalyticsService } from '../services/analytics.service';

/**
 * Team-scoped analytics. Any team member may read; the global
 * TeamMembershipGuard resolves the caller's role.
 */
@ApiTags('team-analytics')
@Controller('teams/:teamId/analytics')
export class TeamAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @ApiOperation({ summary: 'Team task analytics' })
  @Get()
  @RequireTeamRole()
  summary(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.analytics.team(teamId);
  }
}
