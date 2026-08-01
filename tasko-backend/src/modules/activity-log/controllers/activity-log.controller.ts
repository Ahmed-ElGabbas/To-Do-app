import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { ActivityLogQueryDto } from '../dto/activity-log-query.dto';
import { ActivityLogQueryService } from '../services/activity-log-query.service';

@Controller('users/me/activity')
export class ActivityLogController {
  constructor(private readonly activityQuery: ActivityLogQueryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ActivityLogQueryDto,
  ) {
    return this.activityQuery.list(user.id, query);
  }
}
