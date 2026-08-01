import { Injectable, OnModuleInit } from '@nestjs/common';
import { PUSH_JOB } from '../queue/queue.constants';
import { JobHandler } from '../events/task-event.consumer';
import { JobHandlerRegistry } from '../events/job-handler-registry.service';
import { PushMessage, PushService } from './push.service';

/** Routes `push` queue jobs to the configured PushService. */
@Injectable()
export class PushJobHandler implements JobHandler, OnModuleInit {
  readonly name = PUSH_JOB;

  constructor(
    private readonly pushService: PushService,
    private readonly registry: JobHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  handle(data: unknown): Promise<void> {
    return this.pushService.send(data as PushMessage);
  }
}
