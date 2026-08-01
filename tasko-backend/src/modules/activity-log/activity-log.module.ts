import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from '../../common/logger/logger.module';
import { TaskEventsModule } from '../../infrastructure/events/task-events.module';
import { ActivityLogController } from './controllers/activity-log.controller';
import { ActivityLogEntity } from './entities/activity-log.entity';
import { ActivityLogRepository } from './interfaces/activity-log-repository';
import { TypeOrmActivityLogRepository } from './repositories/typeorm-activity-log.repository';
import { ActivityLogQueryService } from './services/activity-log-query.service';
import { ActivityLogService } from './services/activity-log.service';

@Module({
  imports: [
    LoggerModule,
    TypeOrmModule.forFeature([ActivityLogEntity]),
    TaskEventsModule,
  ],
  controllers: [ActivityLogController],
  providers: [
    ActivityLogService,
    ActivityLogQueryService,
    {
      provide: ActivityLogRepository,
      useClass: TypeOrmActivityLogRepository,
    },
  ],
})
export class ActivityLogModule {}
