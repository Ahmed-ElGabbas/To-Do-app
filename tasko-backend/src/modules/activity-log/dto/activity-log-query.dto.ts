import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto';
import { TaskEventType } from '../../../infrastructure/events/task-event';

/** Query parameters for the activity log endpoint. */
export class ActivityLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TaskEventType)
  type?: TaskEventType;
}
