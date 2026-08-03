import { CategoryEntity } from '../entities/category.entity';

/** Data access contract for categories (see TagRepository). */
export abstract class CategoryRepository {
  abstract findById(id: string): Promise<CategoryEntity | null>;

  abstract findByNameForUser(
    userId: string,
    name: string,
  ): Promise<CategoryEntity | null>;

  abstract findByNameForTeam(
    teamId: string,
    name: string,
  ): Promise<CategoryEntity | null>;

  abstract listByUser(userId: string): Promise<CategoryEntity[]>;

  abstract listByTeam(teamId: string): Promise<CategoryEntity[]>;

  /**
   * Searches personal categories plus categories in every team the user
   * belongs to. `teamIds` is empty when the user has no teams.
   */
  abstract searchForUser(
    userId: string,
    teamIds: string[],
    q: string,
    page: number,
    limit: number,
  ): Promise<[CategoryEntity[], number]>;

  abstract create(data: {
    userId: string;
    teamId: string | null;
    name: string;
  }): Promise<CategoryEntity>;

  abstract save(entity: CategoryEntity): Promise<CategoryEntity>;

  abstract remove(id: string): Promise<void>;
}
