import { IsIn, IsOptional, IsUUID, Matches, MaxLength } from 'class-validator';
import { IsBooleanString, IsEnum, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import { TaskSortBy } from '../../../common/constants/task-sort-by.enum';
import type { TaskSortDir } from '../../../common/constants/task-sort-by.enum';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Query parameters for the task list endpoint. */
export class TaskListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['today', 'tomorrow'])
  date?: 'today' | 'tomorrow';

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'dateFrom must be yyyy-MM-dd' })
  dateFrom?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'dateTo must be yyyy-MM-dd' })
  dateTo?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsBooleanString()
  isDone?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsEnum(TaskSortBy)
  sortBy?: TaskSortBy;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: TaskSortDir;
}
