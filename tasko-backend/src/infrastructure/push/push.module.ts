import { forwardRef, Module } from '@nestjs/common';
import { LoggerModule } from '../../common/logger/logger.module';
import { LoggerService } from '../../common/logger/logger.service';
import { NotificationModule } from '../../modules/notification/notification.module';
import { DeviceTokenRepository } from '../../modules/notification/interfaces/device-token-repository';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { FcmPushService } from '../firebase/fcm-push.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { QueueModule } from '../queue/queue.module';
import { TaskEventsModule } from '../events/task-events.module';
import { NoopPushService } from './noop-push.service';
import { PushDispatcher } from './push-dispatcher.service';
import { PushJobHandler } from './push-job-handler';
import { PushService } from './push.service';

/**
 * Registers the current push provider behind the PushService abstraction plus
 * the async push dispatcher. When Firebase credentials are configured the FCM
 * provider is selected; otherwise a no-op keeps flows observable. The
 * forwardRef to NotificationModule exists because FcmPushService prunes stale
 * device tokens through DeviceTokenRepository while NotificationModule consumes
 * PushDispatcher.
 */
@Module({
  imports: [
    LoggerModule,
    QueueModule,
    TaskEventsModule,
    FirebaseModule,
    forwardRef(() => NotificationModule),
  ],
  providers: [
    {
      provide: PushService,
      inject: [FirebaseAdminService, DeviceTokenRepository, LoggerService],
      useFactory: (
        firebase: FirebaseAdminService,
        devices: DeviceTokenRepository,
        logger: LoggerService,
      ): PushService =>
        firebase.isConfigured()
          ? new FcmPushService(firebase, devices, logger)
          : new NoopPushService(logger),
    },
    PushDispatcher,
    PushJobHandler,
  ],
  exports: [PushService, PushDispatcher],
})
export class PushModule {}
