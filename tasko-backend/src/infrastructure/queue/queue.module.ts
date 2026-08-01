import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import type { QueueOptions } from 'bullmq';
import { LoggerModule } from '../../common/logger/logger.module';
import { QueueService } from './queue.service';

/**
 * Queue infrastructure. Registers the shared BullMQ connection options only —
 * connection is opened lazily when the first queue is consumed (Phase 2). When
 * no REDIS_URL is configured, BullMQ receives no connection and the facade
 * reports the queue as disabled.
 */
@Module({
  imports: [
    LoggerModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): QueueOptions => {
        const url = config.get<string>('redis.url');
        return url
          ? { connection: { url } }
          : ({ connection: undefined } as unknown as QueueOptions);
      },
    }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
