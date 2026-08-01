import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { MemoryCacheService } from './memory-cache.service';
import { RedisCacheService } from './redis-cache.service';

/**
 * Selects the cache implementation based on validated config: Redis when
 * REDIS_URL is set, otherwise an in-memory fallback. Abstracted so every
 * consumer depends on CacheService, never on a vendor class.
 */
@Module({
  providers: [
    {
      provide: CacheService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): CacheService => {
        const redisUrl = config.get<string>('redis.url');
        return redisUrl
          ? new RedisCacheService(redisUrl)
          : new MemoryCacheService();
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
