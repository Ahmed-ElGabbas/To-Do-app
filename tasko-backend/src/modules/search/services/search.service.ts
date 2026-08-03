import { Injectable } from '@nestjs/common';
import { ForbiddenActionError } from '../../../common/errors/domain-error';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { CategoryEntity } from '../../category/entities/category.entity';
import { CategoryRepository } from '../../category/interfaces/category-repository';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TagEntity } from '../../tag/entities/tag.entity';
import { TagRepository } from '../../tag/interfaces/tag-repository';
import { TaskEntity } from '../../task/entities/task.entity';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { toTaskOutput } from '../../task/services/task.mapper';
import { TeamEntity } from '../../team/entities/team.entity';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { SearchScope } from '../constants/search-scope.enum';
import { SearchQueryDto } from '../dto/search-query.dto';
import {
  SearchCategoryItem,
  SearchResults,
  SearchTagItem,
  SearchTaskItem,
  SearchTeamItem,
} from '../dto/search.output';

/**
 * Cross-resource search over everything the caller can see: personal tasks
 * plus the tasks, categories and tags of every team they belong to, and the
 * teams themselves. An explicit `teamId` restricts the search to that team
 * after checking membership; otherwise the caller's team set is resolved from
 * their memberships.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamRepository,
    private readonly categories: CategoryRepository,
    private readonly tags: TagRepository,
    private readonly members: MemberRepository,
  ) {}

  async search(
    user: AuthenticatedUser,
    dto: SearchQueryDto,
  ): Promise<SearchResults> {
    const q = dto.q.trim();
    const scope = dto.scope ?? SearchScope.ALL;
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    let teamIds: string[];
    if (dto.teamId) {
      const membership = await this.members.findByTeamAndUser(
        dto.teamId,
        user.id,
      );
      if (!membership) {
        throw new ForbiddenActionError('You are not a member of this team');
      }
      teamIds = [dto.teamId];
    } else {
      const rows = await this.teams.listForMember(user.id);
      teamIds = rows.map((row) => row.team.id);
    }

    const want = (target: SearchScope): boolean =>
      scope === SearchScope.ALL || scope === target;

    const [taskPage, teamPage, categoryPage, tagPage] = await Promise.all([
      want(SearchScope.TASKS)
        ? this.tasks.search({ q, userId: user.id, teamIds, page, limit })
        : Promise.resolve<[TaskEntity[], number]>([[], 0]),
      want(SearchScope.TEAMS)
        ? this.teams.searchForMember(user.id, q, {
            teamId: dto.teamId,
            page,
            limit,
          })
        : Promise.resolve<[TeamEntity[], number]>([[], 0]),
      want(SearchScope.CATEGORIES)
        ? this.categories.searchForUser(user.id, teamIds, q, page, limit)
        : Promise.resolve<[CategoryEntity[], number]>([[], 0]),
      want(SearchScope.TAGS)
        ? this.tags.searchForUser(user.id, teamIds, q, page, limit)
        : Promise.resolve<[TagEntity[], number]>([[], 0]),
    ]);

    return {
      query: q,
      scope,
      page,
      limit,
      results: {
        tasks: {
          total: taskPage[1],
          items: taskPage[0].map(toSearchTaskItem),
        },
        teams: {
          total: teamPage[1],
          items: teamPage[0].map(toSearchTeamItem),
        },
        categories: {
          total: categoryPage[1],
          items: categoryPage[0].map(toSearchCategoryItem),
        },
        tags: {
          total: tagPage[1],
          items: tagPage[0].map(toSearchTagItem),
        },
      },
    };
  }
}

function toSearchTaskItem(task: TaskEntity): SearchTaskItem {
  return { type: 'task', ...toTaskOutput(task) };
}

function toSearchTeamItem(team: TeamEntity): SearchTeamItem {
  return {
    type: 'team',
    id: team.id,
    name: team.name,
    description: team.description,
    ownerId: team.ownerId,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

function toSearchCategoryItem(category: CategoryEntity): SearchCategoryItem {
  return {
    type: 'category',
    id: category.id,
    name: category.name,
    teamId: category.teamId,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function toSearchTagItem(tag: TagEntity): SearchTagItem {
  return {
    type: 'tag',
    id: tag.id,
    name: tag.name,
    teamId: tag.teamId,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}
