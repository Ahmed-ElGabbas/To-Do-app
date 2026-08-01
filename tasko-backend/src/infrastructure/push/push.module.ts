import { Module } from '@nestjs/common';
import { LoggerModule } from '../../common/logger/logger.module';
import { QueueModule } from '../queue/queue.module';
import { TaskEventsModule } from '../events/task-events.module';
import { NoopPushService } from './noop-push.service';
import { PushDispatcher } from './push-dispatcher.service';
import { PushJobHandler } from './push-job-handler';
import { PushService } from './push.service';

/**
 * Registers the current push provider behind the PushService abstraction plus
 * the async push dispatcher. Phase 1 ships NoopPushService; provider selection
 * will read validated config once a vendor is integrated.
 */
@Module({
  imports: [LoggerModule, QueueModule, TaskEventsModule],
  providers: [
    {
      provide: PushService,
      useClass: NoopPushService,
    },
    PushDispatcher,
    PushJobHandler,
  ],
  exports: [PushService, PushDispatcher],
})
export class PushModule {}
