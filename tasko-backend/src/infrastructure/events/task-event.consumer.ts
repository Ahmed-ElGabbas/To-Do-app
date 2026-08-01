import { TaskEvent } from './task-event';

/** Consumes task domain events (Notification, Activity Log, ...). */
export interface TaskEventConsumer {
  handle(event: TaskEvent): Promise<void>;
}

/** Routes a named queue job to its handler. */
export interface JobHandler {
  name: string;
  handle(data: unknown): Promise<void>;
}
