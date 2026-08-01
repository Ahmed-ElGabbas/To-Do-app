import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { LoggerService } from '../../common/logger/logger.service';
import { QueueService } from '../queue/queue.service';
import { TASKO_QUEUE, TASK_EVENT_JOB } from '../queue/queue.constants';
import { TaskEvent } from './task-event';
import { TaskEventConsumer } from './task-event.consumer';
import { JobHandlerRegistry } from './job-handler-registry.service';

const QUEUE_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 200,
  removeOnFail: 500,
};

/**
 * Publishes domain events. With Redis available the event is enqueued as a
 * retryable BullMQ job consumed by {@link TaskoWorker}; without Redis it is
 * dispatched in-process so the app keeps working without a broker (tests).
 * Publish failures are logged and swallowed — events are best-effort side
 * effects and must never fail the task write that produced them.
 */
@Injectable()
export class TaskEventBus implements OnModuleInit {
  private readonly consumers = new Set<TaskEventConsumer>();

  constructor(
    private readonly queueService: QueueService,
    private readonly registry: JobHandlerRegistry,
    @Optional()
    @InjectQueue(TASKO_QUEUE)
    private readonly queue: Queue<TaskEvent> | undefined,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('TaskEvents');
  }

  onModuleInit(): void {
    this.registry.register({
      name: TASK_EVENT_JOB,
      handle: (data) => this.dispatch(data as TaskEvent),
    });
  }

  register(consumer: TaskEventConsumer): void {
    this.consumers.add(consumer);
  }

  unregister(consumer: TaskEventConsumer): void {
    this.consumers.delete(consumer);
  }

  async publish(event: TaskEvent): Promise<void> {
    try {
      if (this.queueService.isEnabled() && this.queue) {
        await this.queue.add(TASK_EVENT_JOB, event, QUEUE_JOB_OPTIONS);
        return;
      }
      await this.dispatch(event);
    } catch (error) {
      this.logger.error('task_event_publish_failed', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Delivers an event to every registered consumer (worker or in-process). */
  async dispatch(event: TaskEvent): Promise<void> {
    for (const consumer of this.consumers) {
      try {
        await consumer.handle(event);
      } catch (error) {
        this.logger.error('task_event_consumer_failed', {
          eventId: event.id,
          consumer: consumer.constructor.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
