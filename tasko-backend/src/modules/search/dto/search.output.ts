import { CategoryOutput } from '../../category/dto/category.output';
import { TagOutput } from '../../tag/dto/tag.output';
import { TaskOutput } from '../../task/dto/task.output';
import { TeamOutput } from '../../team/dto/team.output';
import { SearchScope } from '../constants/search-scope.enum';

/** Discriminator carried by every search result item. */
export type SearchResource = 'task' | 'team' | 'category' | 'tag';

export interface SearchTaskItem extends TaskOutput {
  type: 'task';
}

export interface SearchTeamItem extends TeamOutput {
  type: 'team';
}

export interface SearchCategoryItem extends CategoryOutput {
  type: 'category';
}

export interface SearchTagItem extends TagOutput {
  type: 'tag';
}

/** One result group: a page of items plus the total number of matches. */
export interface SearchGroup<T> {
  total: number;
  items: T[];
}

/** Grouped, discriminated response of the search endpoint. */
export interface SearchResults {
  query: string;
  scope: SearchScope;
  page: number;
  limit: number;
  results: {
    tasks: SearchGroup<SearchTaskItem>;
    teams: SearchGroup<SearchTeamItem>;
    categories: SearchGroup<SearchCategoryItem>;
    tags: SearchGroup<SearchTagItem>;
  };
}
