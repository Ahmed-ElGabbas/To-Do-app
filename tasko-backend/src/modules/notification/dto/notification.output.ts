import { NotificationType } from '../constants/notification-type.enum';
import { NotificationData } from '../entities/notification.entity';

/** Response shape for a notification. */
export interface NotificationOutput {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}
