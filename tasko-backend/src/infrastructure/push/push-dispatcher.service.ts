import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { LoggerService } from '../../common/logger/logger.service';
import { QueueService } from '../queue/queue.service';
import { PUSH_JOB, TASKO_QUEUE } from '../queue/queue.constants';
import { PushMessage, PushService } from './push.service';

const QUEUE_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 200,
  removeOnFail: 500,
};

/**
 * Dispatches push messages. With Redis available the message is enqueued as a
 * retryable BullMQ job (provider flakiness is handled by job retries); without
 * Redis it falls back to the configured PushService (Noop in tests). Dispatch
 * failures are logged and swallowed so notification writes never fail.
 */
@Injectable()
export class PushDispatcher {
  constructor(
    private readonly queueService: QueueService,
    private readonly pushService: PushService,
    @Optional()
    @InjectQueue(TASKO_QUEUE)
    private readonly queue: Queue | undefined,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('Push');
  }

  async dispatch(message: PushMessage): Promise<void> {
    try {
      if (this.queueService.isEnabled() && this.queue) {
        await this.queue.add(PUSH_JOB, message, QUEUE_JOB_OPTIONS);
        return;
      }
      await this.pushService.send(message);
    } catch (error) {
      this.logger.error('push_dispatch_failed', {
        title: message.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
