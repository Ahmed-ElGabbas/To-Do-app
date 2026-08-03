import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import { TaskSortBy } from '../../../common/constants/task-sort-by.enum';
import { TaskEntity } from '../entities/task.entity';
import {
  AnalyticsRow,
  AnalyticsScope,
  CreateTaskData,
  TaskListOptions,
  TaskRepository,
  TaskSearchOptions,
} from '../interfaces/task-repository';

@Injectable()
export class TypeOrmTaskRepository extends TaskRepository {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly repo: Repository<TaskEntity>,
  ) {
    super();
  }

  findById(id: string): Promise<TaskEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIdWithTags(id: string): Promise<TaskEntity | null> {
    return this.repo.findOne({ where: { id }, relations: { tags: true } });
  }

  /**
   * Pagination is done in two steps so that joining the many-to-many `tags`
   * relation never skews `total` or the page boundaries.
   */
  async listAndCount(
    options: TaskListOptions,
  ): Promise<[TaskEntity[], number]> {
    const countQuery = this.buildFilteredQuery(options)
      .select('task.id')
      .distinct(true);
    const total = (await countQuery.getRawMany()).length;

    const pageQuery = this.buildFilteredQuery(options);
    this.applyOrderBy(pageQuery, options);
    const items = await pageQuery
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getMany();

    if (items.length > 0) {
      await this.attachTags(items);
    }
    return [items, total];
  }

  create(data: CreateTaskData): Promise<TaskEntity> {
    return this.repo.save(this.repo.create(data));
  }

  /**
   * Matches title OR notes across the caller's personal tasks and every team
   * they belong to. Empty `teamIds` narrows the search to personal tasks.
   */
  async search(options: TaskSearchOptions): Promise<[TaskEntity[], number]> {
    const build = (): SelectQueryBuilder<TaskEntity> => {
      const qb = this.repo.createQueryBuilder('task');
      if (options.teamIds.length > 0) {
        qb.where(
          '((task.userId = :userId AND task.teamId IS NULL) OR task.teamId IN (:...teamIds))',
          { userId: options.userId, teamIds: options.teamIds },
        );
      } else {
        qb.where('task.userId = :userId AND task.teamId IS NULL', {
          userId: options.userId,
        });
      }
      return qb.andWhere(
        '(LOWER(task.title) LIKE LOWER(:q) OR LOWER(task.notes) LIKE LOWER(:q))',
        { q: `%${options.q}%` },
      );
    };

    const total = (await build().select('task.id').distinct(true).getRawMany())
      .length;

    const items = await build()
      .orderBy('task.createdAt', 'DESC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getMany();

    if (items.length > 0) {
      await this.attachTags(items);
    }
    return [items, total];
  }

  async listForAnalytics(scope: AnalyticsScope): Promise<AnalyticsRow[]> {
    const qb = this.repo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.category', 'category');
    if (scope.teamId) {
      qb.where('task.teamId = :teamId', { teamId: scope.teamId });
    } else {
      qb.where('task.userId = :userId AND task.teamId IS NULL', {
        userId: scope.userId,
      });
    }
    const rows = await qb.getMany();
    return rows.map((task) => ({
      id: task.id,
      isDone: task.isDone,
      priority: task.priority,
      date: task.date,
      categoryId: task.categoryId,
      categoryName: task.category?.name ?? null,
      completedAt: task.completedAt,
    }));
  }

  save(entity: TaskEntity): Promise<TaskEntity> {
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  countAll(): Promise<number> {
    return this.repo.count();
  }

  countCompleted(): Promise<number> {
    return this.repo.count({ where: { isDone: true } });
  }

  private buildFilteredQuery(
    options: TaskListOptions,
  ): SelectQueryBuilder<TaskEntity> {
    const qb = this.repo.createQueryBuilder('task');
    if (options.teamId) {
      qb.where('task.teamId = :teamId', { teamId: options.teamId });
    } else {
      qb.where('task.userId = :userId', { userId: options.userId }).andWhere(
        'task.teamId IS NULL',
      );
    }

    if (options.relativeLabel && options.relativeIso) {
      qb.andWhere('(task.date = :label OR task.date = :iso)', {
        label: options.relativeLabel,
        iso: options.relativeIso,
      });
    } else if (options.dateFrom || options.dateTo) {
      if (options.dateFrom && options.dateTo) {
        qb.andWhere('task.date BETWEEN :dateFrom AND :dateTo', {
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
        });
      } else if (options.dateFrom) {
        qb.andWhere('task.date >= :dateFrom', { dateFrom: options.dateFrom });
      } else {
        qb.andWhere('task.date <= :dateTo', { dateTo: options.dateTo });
      }
    }

    if (options.priority) {
      qb.andWhere('task.priority = :priority', {
        priority: options.priority,
      });
    }
    if (options.isDone !== undefined) {
      qb.andWhere('task.isDone = :isDone', { isDone: options.isDone });
    }
    if (options.categoryId) {
      qb.andWhere('task.categoryId = :categoryId', {
        categoryId: options.categoryId,
      });
    }
    if (options.tagId) {
      qb.innerJoin('task.tags', 'filter_tag', 'filter_tag.id = :tagId', {
        tagId: options.tagId,
      });
    }
    if (options.query) {
      qb.andWhere('LOWER(task.title) LIKE LOWER(:query)', {
        query: `%${options.query}%`,
      });
    }
    return qb;
  }

  private applyOrderBy(
    qb: SelectQueryBuilder<TaskEntity>,
    options: TaskListOptions,
  ): void {
    if (options.sortBy === TaskSortBy.PRIORITY) {
      qb.orderBy(
        `CASE task.priority WHEN :high THEN 0 WHEN :medium THEN 1 ELSE 2 END`,
        options.sortDir,
      ).setParameters({
        high: TaskPriority.HIGH,
        medium: TaskPriority.MEDIUM,
      });
    } else if (options.sortBy === TaskSortBy.TITLE) {
      qb.orderBy('task.title', options.sortDir);
    } else {
      qb.orderBy('task.createdAt', options.sortDir);
    }
  }

  /** Fills `task.tags` for a page of already-loaded tasks. */
  private async attachTags(tasks: TaskEntity[]): Promise<void> {
    const ids = tasks.map((task) => task.id);
    const withTags = await this.repo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.tags', 'tags')
      .where('task.id IN (:...ids)', { ids })
      .getMany();
    const tagMap = new Map(withTags.map((task) => [task.id, task.tags]));
    for (const task of tasks) {
      task.tags = tagMap.get(task.id) ?? [];
    }
  }
}
