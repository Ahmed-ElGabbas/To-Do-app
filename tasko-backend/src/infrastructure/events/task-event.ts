/**
 * Domain events emitted by feature services and consumed asynchronously by
 * Notification and Activity Log. The contract lives in infrastructure so
 * producers and consumers stay decoupled from each other's modules.
 */
export enum TaskEventType {
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_COMPLETED = 'task.completed',
  TASK_REOPENED = 'task.reopened',
  TASK_DELETED = 'task.deleted',
  COMMENT_ADDED = 'comment.added',
  INVITATION_ACCEPTED = 'invitation.accepted',
  TASK_ASSIGNED = 'task.assigned',
}

export interface TaskEventData {
  /** Task title at the time the event occurred. */
  title?: string;
  /** Set on COMMENT_ADDED events. */
  commentId?: string;
  /** Comment body at the time the event occurred. */
  comment?: string;
  /** Invited e-mail on INVITATION_ACCEPTED events. */
  invitedEmail?: string;
}

export interface TaskEvent {
  /** Unique event id so consumers can dedupe retried deliveries. */
  id: string;
  type: TaskEventType;
  /** The user the event is primarily addressed to (recipient or actor). */
  userId: string;
  /** Set for events tied to a task; absent for team-level events. */
  taskId?: string;
  /** ISO-8601 timestamp when the event occurred. */
  occurredAt: string;
  data: TaskEventData;
}
