import { Module } from '@nestjs/common';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { MailerModule } from '../../infrastructure/mailer/mailer.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [CacheModule, QueueModule, MailerModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
