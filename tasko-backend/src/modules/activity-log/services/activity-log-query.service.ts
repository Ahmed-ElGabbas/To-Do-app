import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/types/paginated-result';
import { ActivityLogQueryDto } from '../dto/activity-log-query.dto';
import { ActivityLogOutput } from '../dto/activity-log.output';
import { toActivityLogOutput } from '../dto/activity-log.mapper';
import { ActivityLogRepository } from '../interfaces/activity-log-repository';

/** Read operations for the personal activity feed. */
@Injectable()
export class ActivityLogQueryService {
  constructor(private readonly logs: ActivityLogRepository) {}

  async list(
    userId: string,
    query: ActivityLogQueryDto,
  ): Promise<PaginatedResult<ActivityLogOutput>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.logs.listAndCount(userId, {
      page,
      limit,
      type: query.type,
    });
    return {
      items: items.map(toActivityLogOutput),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
