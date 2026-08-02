import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ResourceNotFoundError,
  ValidationError,
} from '../../../common/errors/domain-error';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import {
  TaskEvent,
  TaskEventType,
} from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { CategoryEntity } from '../../category/entities/category.entity';
import { CategoryRepository } from '../../category/interfaces/category-repository';
import { TagEntity } from '../../tag/entities/tag.entity';
import { TagRepository } from '../../tag/interfaces/tag-repository';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskOutput } from '../dto/task.output';
import { TaskEntity } from '../entities/task.entity';
import { TaskRepository } from '../interfaces/task-repository';
import { TaskQueryService } from './task-query.service';
import { toTaskOutput } from './task.mapper';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The ownership context a task write operates in. Either personal
 * (`teamId` unset) or team-scoped (`teamId` set).
 */
interface TaskScope {
  userId: string;
  teamId?: string;
}

/** Write operations for tasks (create, update, toggle, delete). */
@Injectable()
export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly categories: CategoryRepository,
    private readonly tags: TagRepository,
    private readonly taskQuery: TaskQueryService,
    private readonly eventBus: TaskEventBus,
  ) {}

  async create(userId: string, dto: CreateTaskDto): Promise<TaskOutput> {
    return this.createTask({ userId }, dto);
  }

  /** Creates a task inside a team. The caller's role is the guard's job. */
  async createInTeam(
    teamId: string,
    userId: string,
    dto: CreateTaskDto,
  ): Promise<TaskOutput> {
    return this.createTask({ userId, teamId }, dto);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<TaskOutput> {
    const task = await this.taskQuery.getOwnedTask(userId, id);
    return this.updateTask({ userId }, task, dto);
  }

  /** Updates a team task. The caller's role is the guard's job. */
  async updateInTeam(
    teamId: string,
    userId: string,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<TaskOutput> {
    const task = await this.taskQuery.getTeamTask(teamId, id);
    return this.updateTask({ userId, teamId }, task, dto);
  }

  async toggleDone(
    userId: string,
    id: string,
    isDone: boolean,
  ): Promise<TaskOutput> {
    const task = await this.taskQuery.getOwnedTask(userId, id);
    return this.toggleTask({ userId }, task, isDone);
  }

  async toggleDoneInTeam(
    teamId: string,
    userId: string,
    id: string,
    isDone: boolean,
  ): Promise<TaskOutput> {
    const task = await this.taskQuery.getTeamTask(teamId, id);
    return this.toggleTask({ userId, teamId }, task, isDone);
  }

  async remove(userId: string, id: string): Promise<void> {
    const task = await this.taskQuery.getOwnedTask(userId, id);
    await this.removeTask({ userId }, task);
  }

  async removeInTeam(
    teamId: string,
    userId: string,
    id: string,
  ): Promise<void> {
    const task = await this.taskQuery.getTeamTask(teamId, id);
    await this.removeTask({ userId, teamId }, task);
  }

  private async createTask(
    scope: TaskScope,
    dto: CreateTaskDto,
  ): Promise<TaskOutput> {
    this.assertValidDate(dto.date);
    const category = dto.categoryId
      ? await this.ensureCategoryFor(scope, dto.categoryId)
      : null;
    const tagEntities = dto.tagIds?.length
      ? await this.ensureTagsFor(scope, dto.tagIds)
      : [];

    const task = await this.tasks.create({
      id: dto.id,
      userId: scope.userId,
      teamId: scope.teamId ?? null,
      title: dto.title.trim(),
      time: dto.time,
      date: dto.date,
      isDone: dto.isDone ?? false,
      priority: dto.priority ?? TaskPriority.MEDIUM,
      notes: dto.notes?.trim() || null,
      categoryId: category?.id ?? null,
      tags: tagEntities,
    });
    await this.emit(TaskEventType.TASK_CREATED, scope.userId, task);
    return toTaskOutput(task);
  }

  private async updateTask(
    scope: TaskScope,
    task: TaskEntity,
    dto: UpdateTaskDto,
  ): Promise<TaskOutput> {
    if (dto.title !== undefined) {
      task.title = dto.title.trim();
    }
    if (dto.time !== undefined) {
      task.time = dto.time;
    }
    if (dto.date !== undefined) {
      this.assertValidDate(dto.date);
      task.date = dto.date;
    }
    if (dto.isDone !== undefined) {
      task.isDone = dto.isDone;
    }
    if (dto.priority !== undefined) {
      task.priority = dto.priority;
    }
    if (dto.notes !== undefined) {
      task.notes = dto.notes?.trim() || null;
    }
    if (dto.categoryId !== undefined) {
      task.category = dto.categoryId
        ? await this.ensureCategoryFor(scope, dto.categoryId)
        : null;
      task.categoryId = dto.categoryId ?? null;
    }
    if (dto.tagIds !== undefined) {
      task.tags = dto.tagIds.length
        ? await this.ensureTagsFor(scope, dto.tagIds)
        : [];
    }

    const saved = await this.tasks.save(task);
    await this.emit(TaskEventType.TASK_UPDATED, scope.userId, saved);
    return toTaskOutput(saved);
  }

  private async toggleTask(
    scope: TaskScope,
    task: TaskEntity,
    isDone: boolean,
  ): Promise<TaskOutput> {
    task.isDone = isDone;
    const saved = await this.tasks.save(task);
    await this.emit(
      isDone ? TaskEventType.TASK_COMPLETED : TaskEventType.TASK_REOPENED,
      scope.userId,
      saved,
    );
    return toTaskOutput(saved);
  }

  private async removeTask(scope: TaskScope, task: TaskEntity): Promise<void> {
    await this.tasks.remove(task.id);
    await this.emit(TaskEventType.TASK_DELETED, scope.userId, task);
  }

  /** Publishes a task domain event for downstream consumers. */
  private async emit(
    type: TaskEventType,
    userId: string,
    task: Pick<TaskEntity, 'id' | 'title'>,
  ): Promise<void> {
    const event: TaskEvent = {
      id: randomUUID(),
      type,
      userId,
      taskId: task.id,
      occurredAt: new Date().toISOString(),
      data: { title: task.title },
    };
    await this.eventBus.publish(event);
  }

  /**
   * Validates that the category exists in the current scope: a personal scope
   * requires a personal category owned by the caller; a team scope requires a
   * category belonging to the same team. Cross-scope references are hidden.
   */
  private async ensureCategoryFor(
    scope: TaskScope,
    categoryId: string,
  ): Promise<CategoryEntity> {
    const category = await this.categories.findById(categoryId);
    if (!category) {
      throw new ResourceNotFoundError('Category not found');
    }
    if (scope.teamId) {
      if (category.teamId !== scope.teamId) {
        throw new ResourceNotFoundError('Category not found');
      }
      return category;
    }
    if (category.userId !== scope.userId || category.teamId !== null) {
      throw new ResourceNotFoundError('Category not found');
    }
    return category;
  }

  /** Validates that every tag exists in the current scope (see ensureCategoryFor). */
  private async ensureTagsFor(
    scope: TaskScope,
    tagIds: string[],
  ): Promise<TagEntity[]> {
    const uniqueIds = [...new Set(tagIds)];
    const tags = scope.teamId
      ? await this.tags.findByIdsForTeam(scope.teamId, uniqueIds)
      : await this.tags.findByIdsForUser(scope.userId, uniqueIds);
    if (tags.length !== uniqueIds.length) {
      throw new ResourceNotFoundError('One or more tags were not found');
    }
    return tags;
  }

  /** `date` shape is enforced by the DTO; this rejects impossible calendars. */
  private assertValidDate(date: string): void {
    if (date === 'today' || date === 'tomorrow') {
      return;
    }
    if (!ISO_DATE_PATTERN.test(date)) {
      throw new ValidationError(
        'date must be "today", "tomorrow", or yyyy-MM-dd',
      );
    }
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new ValidationError('date is not a valid calendar date');
    }
  }
}
