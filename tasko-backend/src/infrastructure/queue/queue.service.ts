import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Phase-1 queue facade. BullMQ worker/queue registration arrives in Phase 2
 * (where the first job type is consumed); this service exposes whether the
 * queue is enabled and probes its Redis-backed health so the Health module can
 * report queue readiness without instantiating a worker.
 */
@Injectable()
export class QueueService {
  private readonly redisUrl: string;

  constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('Queue');
    this.redisUrl = config.get<string>('redis.url') ?? '';
  }

  isEnabled(): boolean {
    return this.redisUrl.length > 0;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isEnabled()) {
      return true;
    }
    const probe = new Redis(this.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await probe.connect();
      return (await probe.ping()) === 'PONG';
    } catch {
      this.logger.warn('queue_health_check_failed');
      return false;
    } finally {
      probe.disconnect();
    }
  }
}
