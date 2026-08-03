import { Module } from '@nestjs/common';
import { TaskModule } from '../task/task.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { TeamAnalyticsController } from './controllers/team-analytics.controller';
import { AnalyticsService } from './services/analytics.service';

@Module({
  imports: [TaskModule],
  controllers: [AnalyticsController, TeamAnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
