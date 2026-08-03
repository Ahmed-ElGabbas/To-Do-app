import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TeamRole } from '../../../common/constants/team-role.enum';
import {
  ForbiddenActionError,
  ResourceNotFoundError,
} from '../../../common/errors/domain-error';
import { TaskEventType } from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TaskEntity } from '../../task/entities/task.entity';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { CommentOutput, toCommentOutput } from '../dto/comment.output';
import { CommentEntity } from '../entities/comment.entity';
import { CommentRepository } from '../interfaces/comment-repository';

const ROLE_RANK: Record<TeamRole, number> = {
  [TeamRole.VIEWER]: 0,
  [TeamRole.EDITOR]: 1,
  [TeamRole.OWNER]: 2,
};

/**
 * Task comments with tenant isolation: a caller can only see/comment on tasks
 * they own (personal) or belong to (team). Missing tasks, other tenants' tasks
 * and team tasks of other teams are all reported as a generic 404. Editing or
 * deleting a comment is allowed for its author or — on team tasks — any
 * editor/owner of that team.
 */
@Injectable()
export class CommentService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly tasks: TaskRepository,
    private readonly members: MemberRepository,
    private readonly eventBus: TaskEventBus,
  ) {}

  async list(taskId: string, viewerId: string): Promise<CommentOutput[]> {
    await this.getAccessibleTask(taskId, viewerId);
    const rows = await this.comments.listByTask(taskId);
    return rows.map(toCommentOutput);
  }

  async create(
    taskId: string,
    viewerId: string,
    dto: CreateCommentDto,
  ): Promise<CommentOutput> {
    const task = await this.getAccessibleTask(taskId, viewerId);
    const comment = await this.comments.create({
      taskId,
      userId: viewerId,
      body: dto.body.trim(),
    });
    if (task.userId !== viewerId) {
      await this.eventBus.publish({
        id: randomUUID(),
        type: TaskEventType.COMMENT_ADDED,
        userId: task.userId,
        taskId: task.id,
        occurredAt: new Date().toISOString(),
        data: {
          title: task.title,
          commentId: comment.id,
          comment: comment.body,
        },
      });
    }
    return toCommentOutput(comment);
  }

  async update(
    id: string,
    viewerId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentOutput> {
    const comment = await this.loadEditableComment(id, viewerId);
    comment.body = dto.body.trim();
    const saved = await this.comments.save(comment);
    return toCommentOutput(saved);
  }

  async remove(id: string, viewerId: string): Promise<void> {
    const comment = await this.loadEditableComment(id, viewerId);
    await this.comments.remove(comment.id);
  }

  /**
   * Loads a task the caller may access: personal tasks owned by the caller or
   * team tasks of a team the caller belongs to. Anything else is a 404.
   */
  private async getAccessibleTask(
    taskId: string,
    viewerId: string,
  ): Promise<TaskEntity> {
    const task = await this.tasks.findById(taskId);
    if (!task) {
      throw new ResourceNotFoundError('Task not found');
    }
    if (task.teamId === null) {
      if (task.userId !== viewerId) {
        throw new ResourceNotFoundError('Task not found');
      }
      return task;
    }
    const membership = await this.members.findByTeamAndUser(
      task.teamId,
      viewerId,
    );
    if (!membership) {
      throw new ResourceNotFoundError('Task not found');
    }
    return task;
  }

  /**
   * Loads a comment the caller may edit/delete: they must first access the
   * task (404 otherwise), then be the author or a team editor/owner (403).
   */
  private async loadEditableComment(
    id: string,
    viewerId: string,
  ): Promise<CommentEntity> {
    const comment = await this.comments.findById(id);
    if (!comment) {
      throw new ResourceNotFoundError('Comment not found');
    }
    const task = await this.tasks.findById(comment.taskId);
    if (!task) {
      throw new ResourceNotFoundError('Comment not found');
    }

    const canAccess =
      task.teamId === null
        ? task.userId === viewerId
        : Boolean(await this.members.findByTeamAndUser(task.teamId, viewerId));
    if (!canAccess) {
      throw new ResourceNotFoundError('Comment not found');
    }

    if (comment.userId === viewerId) {
      return comment;
    }
    if (task.teamId !== null) {
      const membership = await this.members.findByTeamAndUser(
        task.teamId,
        viewerId,
      );
      if (
        membership &&
        ROLE_RANK[membership.role] >= ROLE_RANK[TeamRole.EDITOR]
      ) {
        return comment;
      }
    }
    throw new ForbiddenActionError(
      'You are not allowed to modify this comment',
    );
  }
}
