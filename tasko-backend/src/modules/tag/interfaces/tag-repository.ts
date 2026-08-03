import { TagEntity } from '../entities/tag.entity';

/**
 * Data access contract for tags. The concrete TypeORM implementation lives in
 * `repositories/`; services only depend on this abstraction.
 */
export abstract class TagRepository {
  abstract findById(id: string): Promise<TagEntity | null>;

  /** Case-insensitive lookup used to enforce unique tag names per user. */
  abstract findByNameForUser(
    userId: string,
    name: string,
  ): Promise<TagEntity | null>;

  /** Case-insensitive lookup used to enforce unique tag names per team. */
  abstract findByNameForTeam(
    teamId: string,
    name: string,
  ): Promise<TagEntity | null>;

  abstract listByUser(userId: string): Promise<TagEntity[]>;

  abstract listByTeam(teamId: string): Promise<TagEntity[]>;

  /**
   * Searches personal tags plus tags in every team the user belongs to.
   * `teamIds` is empty when the user has no teams.
   */
  abstract searchForUser(
    userId: string,
    teamIds: string[],
    q: string,
    page: number,
    limit: number,
  ): Promise<[TagEntity[], number]>;

  /** Loads only personal tags owned by `userId`. Used to validate task tag references. */
  abstract findByIdsForUser(
    userId: string,
    ids: string[],
  ): Promise<TagEntity[]>;

  /** Loads only tags belonging to `teamId`. Used to validate team task tag references. */
  abstract findByIdsForTeam(
    teamId: string,
    ids: string[],
  ): Promise<TagEntity[]>;

  abstract create(data: {
    userId: string;
    teamId: string | null;
    name: string;
  }): Promise<TagEntity>;

  abstract save(entity: TagEntity): Promise<TagEntity>;

  abstract remove(id: string): Promise<void>;
}
