import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchService } from '../services/search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.search(user, query);
  }
}
