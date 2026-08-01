/**
 * Domain events emitted by the Task write service and consumed asynchronously
 * by Notification and Activity Log. The contract lives in infrastructure so
 * producers and consumers stay decoupled from each other's modules.
 */
export enum TaskEventType {
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_COMPLETED = 'task.completed',
  TASK_REOPENED = 'task.reopened',
  TASK_DELETED = 'task.deleted',
}

export interface TaskEventData {
  /** Task title at the time the event occurred. */
  title: string;
}

export interface TaskEvent {
  /** Unique event id so consumers can dedupe retried deliveries. */
  id: string;
  type: TaskEventType;
  userId: string;
  taskId: string;
  /** ISO-8601 timestamp when the event occurred. */
  occurredAt: string;
  data: TaskEventData;
}
