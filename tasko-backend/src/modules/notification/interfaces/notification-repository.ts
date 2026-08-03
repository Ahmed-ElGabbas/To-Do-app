import { NotificationType } from '../constants/notification-type.enum';
import {
  NotificationData,
  NotificationEntity,
} from '../entities/notification.entity';

export interface NotificationListOptions {
  page: number;
  limit: number;
  isRead?: boolean;
}

export interface CreateNotificationData {
  userId: string;
  eventId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData | null;
}

/** Data access contract for user notifications. */
export abstract class NotificationRepository {
  abstract findByEventId(eventId: string): Promise<NotificationEntity | null>;

  abstract findByIdAndUser(
    id: string,
    userId: string,
  ): Promise<NotificationEntity | null>;

  abstract listAndCount(
    userId: string,
    options: NotificationListOptions,
  ): Promise<[NotificationEntity[], number]>;

  abstract create(data: CreateNotificationData): Promise<NotificationEntity>;

  abstract save(entity: NotificationEntity): Promise<NotificationEntity>;

  /** Marks every unread notification of the user as read; returns the count. */
  abstract markAllRead(userId: string): Promise<number>;
}
