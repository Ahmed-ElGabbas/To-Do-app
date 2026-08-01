import { Injectable, OnModuleInit } from '@nestjs/common';
import { ResourceNotFoundError } from '../../../common/errors/domain-error';
import { LoggerService } from '../../../common/logger/logger.service';
import { PaginatedResult } from '../../../common/types/paginated-result';
import { PushDispatcher } from '../../../infrastructure/push/push-dispatcher.service';
import {
  TaskEvent,
  TaskEventType,
} from '../../../infrastructure/events/task-event';
import { TaskEventConsumer } from '../../../infrastructure/events/task-event.consumer';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { NotificationType } from '../constants/notification-type.enum';
import { NotificationRepository } from '../interfaces/notification-repository';
import { DeviceTokenRepository } from '../interfaces/device-token-repository';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationOutput } from '../dto/notification.output';
import { toNotificationOutput } from '../dto/notification.mapper';

interface NotificationTemplate {
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * Read/write operations for in-app notifications plus the task-event consumer
 * that maps domain events to persisted notifications and queued pushes.
 */
@Injectable()
export class NotificationService implements TaskEventConsumer, OnModuleInit {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly devices: DeviceTokenRepository,
    private readonly pushDispatcher: PushDispatcher,
    private readonly eventBus: TaskEventBus,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('Notifications');
  }

  onModuleInit(): void {
    this.eventBus.register(this);
  }

  async list(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<PaginatedResult<NotificationOutput>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.notifications.listAndCount(userId, {
      page,
      limit,
      isRead: query.isRead === undefined ? undefined : query.isRead === 'true',
    });
    return {
      items: items.map(toNotificationOutput),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationOutput> {
    const notification = await this.notifications.findByIdAndUser(id, userId);
    if (!notification) {
      throw new ResourceNotFoundError('Notification not found');
    }
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return toNotificationOutput(await this.notifications.save(notification));
    }
    return toNotificationOutput(notification);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(userId) };
  }

  /** Event consumer: maps a task event to a notification row + queued push. */
  async handle(event: TaskEvent): Promise<void> {
    const template = notificationForEvent(event);
    if (!template || (await this.notifications.findByEventId(event.id))) {
      return;
    }

    const notification = await this.notifications.create({
      userId: event.userId,
      eventId: event.id,
      type: template.type,
      title: template.title,
      body: template.body,
      data: { taskId: event.taskId },
    });

    const devices = await this.devices.findByUser(event.userId);
    if (devices.length > 0) {
      await this.pushDispatcher.dispatch({
        deviceTokens: devices.map((device) => device.token),
        title: notification.title,
        body: notification.body,
        data: { notificationId: notification.id, taskId: event.taskId },
      });
    }
  }
}

/** Maps a task event to the notification copy; unknown events produce nothing. */
function notificationForEvent(event: TaskEvent): NotificationTemplate | null {
  const quoted = event.data.title ? `"${event.data.title}"` : 'The task';
  switch (event.type) {
    case TaskEventType.TASK_CREATED:
      return {
        type: NotificationType.TASK_CREATED,
        title: 'Task created',
        body: `${quoted} was added.`,
      };
    case TaskEventType.TASK_UPDATED:
      return {
        type: NotificationType.TASK_UPDATED,
        title: 'Task updated',
        body: `${quoted} was updated.`,
      };
    case TaskEventType.TASK_COMPLETED:
      return {
        type: NotificationType.TASK_COMPLETED,
        title: 'Task completed',
        body: `${quoted} was completed.`,
      };
    case TaskEventType.TASK_REOPENED:
      return {
        type: NotificationType.TASK_REOPENED,
        title: 'Task reopened',
        body: `${quoted} was reopened.`,
      };
    case TaskEventType.TASK_DELETED:
      return {
        type: NotificationType.TASK_DELETED,
        title: 'Task deleted',
        body: `${quoted} was deleted.`,
      };
    default:
      return null;
  }
}
