import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  TaskEvent,
  TaskEventType,
} from '../../../infrastructure/events/task-event';
import { TaskEventConsumer } from '../../../infrastructure/events/task-event.consumer';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { ActivityLogRepository } from '../interfaces/activity-log-repository';

/**
 * Task-event consumer that appends an immutable activity record for the user.
 * Delivery is idempotent: a replayed event id is skipped.
 */
@Injectable()
export class ActivityLogService implements TaskEventConsumer, OnModuleInit {
  constructor(
    private readonly logs: ActivityLogRepository,
    private readonly eventBus: TaskEventBus,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('ActivityLog');
  }

  onModuleInit(): void {
    this.eventBus.register(this);
  }

  async handle(event: TaskEvent): Promise<void> {
    // Delivery is idempotent: a replayed event id is skipped.
    if (await this.logs.findByEventId(event.id)) {
      return;
    }

    // Admin role changes are audited against the target account (no task).
    if (event.type === TaskEventType.USER_ROLE_CHANGED) {
      await this.logs.create({
        userId: event.userId,
        eventId: event.id,
        type: event.type,
        entityId: event.data.targetUserId ?? event.userId,
        summary: summarizeEvent(event),
        metadata: { occurredAt: event.occurredAt, data: event.data },
      });
      return;
    }

    // Team-level events (e.g. invitation accepted) have no task to record.
    if (event.taskId === undefined) {
      return;
    }
    await this.logs.create({
      userId: event.userId,
      eventId: event.id,
      type: event.type,
      entityId: event.taskId,
      summary: summarizeEvent(event),
      metadata: { occurredAt: event.occurredAt, data: event.data },
    });
  }
}

function summarizeEvent(event: TaskEvent): string {
  const quoted = event.data.title ? `"${event.data.title}"` : 'a task';
  switch (event.type) {
    case TaskEventType.TASK_CREATED:
      return `Task created: ${quoted}`;
    case TaskEventType.TASK_UPDATED:
      return `Task updated: ${quoted}`;
    case TaskEventType.TASK_COMPLETED:
      return `Task completed: ${quoted}`;
    case TaskEventType.TASK_REOPENED:
      return `Task reopened: ${quoted}`;
    case TaskEventType.TASK_DELETED:
      return `Task deleted: ${quoted}`;
    case TaskEventType.COMMENT_ADDED:
      return `Comment added: ${quoted}`;
    case TaskEventType.TASK_ASSIGNED:
      return `Task assigned: ${quoted}`;
    case TaskEventType.USER_ROLE_CHANGED:
      return `Role changed for ${
        event.data.targetEmail ?? 'a user'
      }: ${event.data.previousRole} -> ${event.data.newRole}`;
    default:
      return `Task event: ${String(event.type)}`;
  }
}
