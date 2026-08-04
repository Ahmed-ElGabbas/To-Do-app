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
  // Emitted when a NEW TEAM TASK is created, notifying every other member
  // (there is no assigneeId concept anywhere); the name predates teams.
  TASK_ASSIGNED = 'task.assigned',
  USER_ROLE_CHANGED = 'user.role.changed',
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
  /** Target account id on USER_ROLE_CHANGED events. */
  targetUserId?: string;
  /** Target account e-mail on USER_ROLE_CHANGED events. */
  targetEmail?: string;
  /** Role before the change on USER_ROLE_CHANGED events. */
  previousRole?: string;
  /** New role on USER_ROLE_CHANGED events. */
  newRole?: string;
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
