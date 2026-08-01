import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/types/paginated-result';
import { ResourceNotFoundError } from '../../../common/errors/domain-error';
import { TaskSortBy } from '../../../common/constants/task-sort-by.enum';
import { TaskListQueryDto } from '../dto/task-list-query.dto';
import { TaskOutput } from '../dto/task.output';
import { TaskEntity } from '../entities/task.entity';
import { TaskRepository } from '../interfaces/task-repository';
import { toTaskOutput } from './task.mapper';

/** Read operations for tasks (list with filters/pagination, single fetch). */
@Injectable()
export class TaskQueryService {
  constructor(private readonly tasks: TaskRepository) {}

  /** Lists the caller's personal tasks (teamId IS NULL). */
  async list(
    userId: string,
    query: TaskListQueryDto,
  ): Promise<PaginatedResult<TaskOutput>> {
    return this.paginate({ userId }, query);
  }

  /** Lists every task in a team (visible to any team member). */
  async listForTeam(
    teamId: string,
    query: TaskListQueryDto,
  ): Promise<PaginatedResult<TaskOutput>> {
    return this.paginate({ teamId }, query);
  }

  async get(userId: string, id: string): Promise<TaskOutput> {
    return toTaskOutput(await this.getOwnedTask(userId, id));
  }

  async getTeam(teamId: string, id: string): Promise<TaskOutput> {
    return toTaskOutput(await this.getTeamTask(teamId, id));
  }

  /**
   * Loads a task and enforces personal ownership. Missing tasks, other users'
   * tasks and team tasks are indistinguishable on purpose (no enumeration).
   */
  async getOwnedTask(userId: string, id: string): Promise<TaskEntity> {
    const task = await this.tasks.findByIdWithTags(id);
    if (!task || task.userId !== userId || task.teamId !== null) {
      throw new ResourceNotFoundError('Task not found');
    }
    return task;
  }

  /** Loads a task scoped to a team. The caller's membership is the guard's job. */
  async getTeamTask(teamId: string, id: string): Promise<TaskEntity> {
    const task = await this.tasks.findByIdWithTags(id);
    if (!task || task.teamId !== teamId) {
      throw new ResourceNotFoundError('Task not found');
    }
    return task;
  }

  private async paginate(
    scope: { userId?: string; teamId?: string },
    query: TaskListQueryDto,
  ): Promise<PaginatedResult<TaskOutput>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const dateFilter = this.resolveDateFilter(query.date);

    const [items, total] = await this.tasks.listAndCount({
      userId: scope.userId,
      teamId: scope.teamId,
      ...dateFilter,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      priority: query.priority,
      isDone: query.isDone === undefined ? undefined : query.isDone === 'true',
      categoryId: query.categoryId,
      tagId: query.tagId,
      query: query.query?.trim() || undefined,
      sortBy: query.sortBy ?? TaskSortBy.CREATED_AT,
      sortDir: query.sortDir ?? 'ASC',
      page,
      limit,
    });

    return {
      items: items.map((task) => toTaskOutput(task)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Resolves the relative `date` filter to a concrete ISO day using the
   * server's local calendar (documented in ADR-0006).
   */
  private resolveDateFilter(date?: 'today' | 'tomorrow'): {
    relativeLabel?: 'today' | 'tomorrow';
    relativeIso?: string;
  } {
    if (date === 'today') {
      return { relativeLabel: 'today', relativeIso: toIsoDate(new Date()) };
    }
    if (date === 'tomorrow') {
      return {
        relativeLabel: 'tomorrow',
        relativeIso: toIsoDate(addDays(new Date(), 1)),
      };
    }
    return {};
  }
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
