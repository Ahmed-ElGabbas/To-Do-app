import { IsBooleanString, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto';

/** Query parameters for the notification list endpoint. */
export class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsBooleanString()
  isRead?: string;
}
