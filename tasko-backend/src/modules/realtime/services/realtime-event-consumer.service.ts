import { Injectable, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  TaskEvent,
  TaskEventType,
} from '../../../infrastructure/events/task-event';
import { TaskEventConsumer } from '../../../infrastructure/events/task-event.consumer';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { toCommentOutput } from '../../comment/dto/comment.output';
import { CommentRepository } from '../../comment/interfaces/comment-repository';
import { toTaskOutput } from '../../task/services/task.mapper';
import { TaskRepository } from '../../task/interfaces/task-repository';
import {
  CommentAddedPayload,
  InvitationAcceptedPayload,
  MemberRemovedPayload,
  RealtimeEnvelope,
  TaskDeletedPayload,
} from '../dto/realtime.event';
import { REALTIME_EVENTS, teamRoom, userRoom } from '../realtime.constants';

/**
 * Task-event consumer that routes domain events to connected sockets.
 * Registers itself with the TaskEventBus like the notification/activity
 * consumers; the gateway supplies the live Socket.IO server via
 * {@link bindServer} once it initializes.
 *
 * Routing (Section 3.3 of the realtime plan): task events go to the
 * `team:<teamId>` room when team-scoped, else to the actor's `user:<userId>`
 * room; `comment.added` uses the task's team scope and `invitation.accepted`
 * and `member.removed` target their team room. `TASK_ASSIGNED` and
 * `USER_ROLE_CHANGED` are deliberately not broadcast (the plan's skip rules).
 *
 * Live payloads are reconstructed from the repository because the domain
 * event only carries a title/commentId — and `task.deleted` is the one case
 * where the row is already gone, so its payload is built from the event itself.
 * Delivery is best-effort: failures are logged by the bus, never propagated to
 * the write that produced the event.
 */
@Injectable()
export class RealtimeEventConsumer implements TaskEventConsumer, OnModuleInit {
  private server?: Server;

  constructor(
    private readonly eventBus: TaskEventBus,
    private readonly tasks: TaskRepository,
    private readonly comments: CommentRepository,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('Realtime');
  }

  onModuleInit(): void {
    this.eventBus.register(this);
  }

  /** Called by the gateway once the Socket.IO server is available. */
  bindServer(server: Server): void {
    this.server = server;
  }

  async handle(event: TaskEvent): Promise<void> {
    switch (event.type) {
      case TaskEventType.TASK_CREATED:
      case TaskEventType.TASK_UPDATED:
      case TaskEventType.TASK_COMPLETED:
      case TaskEventType.TASK_REOPENED:
        await this.onTaskState(event);
        break;
      case TaskEventType.TASK_DELETED:
        this.onTaskDeleted(event);
        break;
      case TaskEventType.COMMENT_ADDED:
        await this.onCommentAdded(event);
        break;
      case TaskEventType.INVITATION_ACCEPTED:
        this.onInvitationAccepted(event);
        break;
      case TaskEventType.MEMBER_REMOVED:
        await this.onMemberRemoved(event);
        break;
      case TaskEventType.SESSIONS_REVOKED:
        await this.onSessionsRevoked(event);
        break;
      // TASK_ASSIGNED and USER_ROLE_CHANGED are deliberately not broadcast.
      default:
        break;
    }
  }

  private async onTaskState(event: TaskEvent): Promise<void> {
    if (!this.server) {
      return;
    }
    const task = await this.tasks.findByIdWithTags(event.taskId ?? '');
    if (!task) {
      this.logger.warn('realtime_task_missing', {
        eventId: event.id,
        taskId: event.taskId,
      });
      return;
    }
    // TaskEventType values equal their wire names ('task.created', ...).
    this.emitToTaskScope(event, event.type, { task: toTaskOutput(task) });
  }

  private onTaskDeleted(event: TaskEvent): void {
    const payload: TaskDeletedPayload = {
      taskId: event.taskId ?? '',
      title: event.data.title ?? 'a task',
      teamId: event.teamId,
    };
    this.emitToTaskScope(event, REALTIME_EVENTS.TASK_DELETED, payload);
  }

  private async onCommentAdded(event: TaskEvent): Promise<void> {
    if (!this.server) {
      return;
    }
    const comment = await this.comments.findById(event.data.commentId ?? '');
    if (!comment) {
      this.logger.warn('realtime_comment_missing', {
        eventId: event.id,
        commentId: event.data.commentId,
      });
      return;
    }
    const payload: CommentAddedPayload = {
      comment: toCommentOutput(comment),
      task: { id: event.taskId ?? '', title: event.data.title ?? 'a task' },
    };
    this.emitToTaskScope(
      event,
      REALTIME_EVENTS.COMMENT_ADDED,
      payload,
      // The event's userId is the task owner (the notification recipient);
      // the actual actor is the commenter, only known from the comment row.
      comment.userId,
    );
  }

  private onInvitationAccepted(event: TaskEvent): void {
    if (!this.server || !event.teamId) {
      return;
    }
    const payload: InvitationAcceptedPayload = {
      teamId: event.teamId,
      invitedEmail: event.data.invitedEmail ?? '',
      invitedBy: { userId: event.userId },
    };
    this.emitToTeam(event, REALTIME_EVENTS.INVITATION_ACCEPTED, payload);
  }

  private async onMemberRemoved(event: TaskEvent): Promise<void> {
    if (!event.teamId || !this.server) {
      return;
    }
    const room = teamRoom(event.teamId);
    const removedSockets = await this.server
      .in(userRoom(event.userId))
      .fetchSockets();
    for (const socket of removedSockets) {
      socket.leave(room);
    }
    // Documented §3.4 deviation: no `actor` — the removed user is the event's
    // subject, and the remover's identity is deliberately not exposed.
    const wireEvent: Omit<RealtimeEnvelope<MemberRemovedPayload>, 'actor'> = {
      eventId: event.id,
      occurredAt: event.occurredAt,
      payload: { teamId: event.teamId, userId: event.userId },
    };
    this.server.to(room).emit(REALTIME_EVENTS.MEMBER_REMOVED, wireEvent);
  }

  /**
   * Sessions revoked (logout-all / password change / reset): force-disconnect
   * every socket of the user with an `auth_error`. The client treats
   * `auth_error` as a handshake failure, tries one refresh — which fails
   * because the user's refresh tokens were just revoked — and signs out
   * (Section 2.2, R8).
   */
  private async onSessionsRevoked(event: TaskEvent): Promise<void> {
    if (!this.server) {
      return;
    }
    const sockets = await this.server.in(userRoom(event.userId)).fetchSockets();
    for (const socket of sockets) {
      socket.emit(REALTIME_EVENTS.AUTH_ERROR, {
        code: 'SESSION_REVOKED',
        message: 'Your session has been revoked',
      });
      socket.disconnect(true);
    }
  }

  private emitToTaskScope(
    event: TaskEvent,
    wireEvent: string,
    payload: unknown,
    actorUserId: string = event.userId,
  ): void {
    if (!this.server) {
      return;
    }
    const room = event.teamId ? teamRoom(event.teamId) : userRoom(event.userId);
    this.emit(room, event, wireEvent, payload, actorUserId);
  }

  private emitToTeam(
    event: TaskEvent,
    wireEvent: string,
    payload: unknown,
  ): void {
    if (!this.server || !event.teamId) {
      return;
    }
    this.emit(teamRoom(event.teamId), event, wireEvent, payload);
  }

  private emit(
    room: string,
    event: TaskEvent,
    wireEvent: string,
    payload: unknown,
    actorUserId: string = event.userId,
  ): void {
    const envelope: RealtimeEnvelope<unknown> = {
      eventId: event.id,
      occurredAt: event.occurredAt,
      actor: { userId: actorUserId },
      payload,
    };
    this.server?.to(room).emit(wireEvent, envelope);
  }
}
