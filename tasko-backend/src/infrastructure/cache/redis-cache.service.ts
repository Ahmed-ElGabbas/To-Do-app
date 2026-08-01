import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CacheService } from './cache.service';

/**
 * Redis-backed cache. Values are JSON-serialized. Used whenever REDIS_URL is
 * configured; provides a shared, horizontally-consistent cache across
 * instances (e.g. throttler storage, refresh-token families).
 */
@Injectable()
export class RedisCacheService
  extends CacheService
  implements OnApplicationShutdown
{
  private readonly client: Redis;

  constructor(redisUrl: string) {
    super();
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (ttlSeconds === undefined) {
      await this.client.set(key, raw);
    } else {
      await this.client.set(key, raw, 'EX', ttlSeconds);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  onApplicationShutdown(): void {
    this.client.disconnect();
  }
}
