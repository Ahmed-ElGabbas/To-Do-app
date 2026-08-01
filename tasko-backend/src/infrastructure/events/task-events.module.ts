import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from '../../common/logger/logger.module';
import { QueueModule } from '../queue/queue.module';
import { TASKO_QUEUE } from '../queue/queue.constants';
import { JobHandlerRegistry } from './job-handler-registry.service';
import { TaskEventBus } from './task-event-bus.service';
import { TaskoWorker } from './tasko-worker';

/**
 * Registers the shared domain-event bus, the job handler registry and — when a
 * Redis URL is configured — the BullMQ queue and worker. Without Redis the
 * TaskEventBus falls back to in-process delivery so the app (and the test
 * suite) runs without a broker. Consumers register themselves with
 * {@link TaskEventBus#register}; queue handlers register with
 * {@link JobHandlerRegistry}.
 */
@Module({})
export class TaskEventsModule {
  static forRoot(): DynamicModule {
    const queueEnabled = Boolean(process.env.REDIS_URL);
    return {
      module: TaskEventsModule,
      global: true,
      imports: [
        LoggerModule,
        QueueModule,
        ...(queueEnabled
          ? [BullModule.registerQueue({ name: TASKO_QUEUE })]
          : []),
      ],
      providers: [
        TaskEventBus,
        JobHandlerRegistry,
        ...(queueEnabled ? [TaskoWorker] : []),
      ],
      exports: [
        TaskEventBus,
        JobHandlerRegistry,
        ...(queueEnabled ? [BullModule] : []),
      ],
    };
  }
}
