import { NotificationEntity } from '../entities/notification.entity';
import { NotificationOutput } from './notification.output';

/** Maps a persisted notification to its whitelisted response shape. */
export function toNotificationOutput(
  notification: NotificationEntity,
): NotificationOutput {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? null,
    isRead: notification.isRead,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
  };
}
