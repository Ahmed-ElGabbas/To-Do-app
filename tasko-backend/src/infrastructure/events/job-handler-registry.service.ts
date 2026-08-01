import { Injectable } from '@nestjs/common';
import { JobHandler } from './task-event.consumer';

/**
 * Resolves queue job names to their handlers. Handlers register themselves on
 * module init (see {@link JobHandlerRegistry.register}) so feature modules can
 * contribute jobs to the shared queue without the events layer knowing them.
 */
@Injectable()
export class JobHandlerRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  register(handler: JobHandler): void {
    this.handlers.set(handler.name, handler);
  }

  unregister(name: string): void {
    this.handlers.delete(name);
  }

  get(name: string): JobHandler | undefined {
    return this.handlers.get(name);
  }
}
