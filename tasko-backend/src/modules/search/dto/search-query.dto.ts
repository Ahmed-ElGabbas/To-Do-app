import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto';
import { SearchScope } from '../constants/search-scope.enum';

/** Query parameters for the cross-resource search endpoint. */
export class SearchQueryDto extends PaginationQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;

  @IsOptional()
  @IsEnum(SearchScope)
  scope?: SearchScope;

  /** When set, search is restricted to that team (membership required). */
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
