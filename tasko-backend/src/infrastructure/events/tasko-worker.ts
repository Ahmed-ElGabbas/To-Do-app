import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '../../common/logger/logger.service';
import { TASKO_QUEUE } from '../queue/queue.constants';
import { JobHandlerRegistry } from './job-handler-registry.service';

/**
 * Single worker for the shared Tasko queue. Routes every job to the handler
 * registered for its job name; unknown job names are logged and skipped.
 */
@Processor(TASKO_QUEUE)
export class TaskoWorker extends WorkerHost {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext('TaskoWorker');
  }

  async process(job: Job): Promise<void> {
    const handler = this.registry.get(job.name);
    if (!handler) {
      this.logger.warn('unhandled_queue_job', {
        name: job.name,
        jobId: job.id,
      });
      return;
    }
    await handler.handle(job.data);
  }
}
