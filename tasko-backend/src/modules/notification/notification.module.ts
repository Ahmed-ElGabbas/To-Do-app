import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from '../../common/logger/logger.module';
import { TaskEventsModule } from '../../infrastructure/events/task-events.module';
import { PushModule } from '../../infrastructure/push/push.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationController } from './controllers/notification.controller';
import { NotificationEntity } from './entities/notification.entity';
import { UserDeviceEntity } from './entities/user-device.entity';
import { DeviceTokenRepository } from './interfaces/device-token-repository';
import { NotificationRepository } from './interfaces/notification-repository';
import { TypeOrmDeviceTokenRepository } from './repositories/typeorm-device-token.repository';
import { TypeOrmNotificationRepository } from './repositories/typeorm-notification.repository';
import { DeviceTokenService } from './services/device-token.service';
import { NotificationService } from './services/notification.service';

@Module({
  imports: [
    LoggerModule,
    TypeOrmModule.forFeature([NotificationEntity, UserDeviceEntity]),
    TaskEventsModule,
    forwardRef(() => PushModule),
    RealtimeModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    DeviceTokenService,
    {
      provide: NotificationRepository,
      useClass: TypeOrmNotificationRepository,
    },
    {
      provide: DeviceTokenRepository,
      useClass: TypeOrmDeviceTokenRepository,
    },
  ],
  exports: [DeviceTokenRepository],
})
export class NotificationModule {}
