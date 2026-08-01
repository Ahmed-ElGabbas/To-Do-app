import {
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { TaskPriority } from '../../../common/constants/task-priority.enum';

/** Matches the 12-hour time format used by the Tasko client, e.g. "06:30 AM". */
const TIME_PATTERN = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;

/** The client's `date` field is "today", "tomorrow", or an ISO calendar date. */
const DATE_PATTERN = /^(today|tomorrow|\d{4}-\d{2}-\d{2})$/;

export class CreateTaskDto {
  /** Client-generated UUID v4; the server generates one only if omitted. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'time must match the 12-hour format, e.g. "06:30 AM"',
  })
  time: string;

  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'date must be "today", "tomorrow", or an ISO yyyy-MM-dd date',
  })
  date: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
