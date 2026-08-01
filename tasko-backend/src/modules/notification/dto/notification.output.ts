import { NotificationType } from '../constants/notification-type.enum';

/** Response shape for a notification. */
export interface NotificationOutput {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { taskId: string } | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}
