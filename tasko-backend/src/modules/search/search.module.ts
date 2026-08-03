import { Module } from '@nestjs/common';
import { CategoryModule } from '../category/category.module';
import { MemberModule } from '../member/member.module';
import { TagModule } from '../tag/tag.module';
import { TaskModule } from '../task/task.module';
import { TeamModule } from '../team/team.module';
import { SearchController } from './controllers/search.controller';
import { SearchService } from './services/search.service';

@Module({
  imports: [TaskModule, TeamModule, CategoryModule, TagModule, MemberModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
