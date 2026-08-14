import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter backed by Redis pub/sub so room broadcasts reach clients
 * on every backend instance. Instantiated in main.ts only when a REDIS_URL is
 * configured; without it the default in-process IoAdapter is used (single
 * instance, correct for local dev and the test suite).
 *
 * The pub/sub clients use the same resilient ioredis options as
 * RedisCacheService (lazyConnect, bounded retries, capped backoff) so a Redis
 * outage degrades delivery rather than blocking app startup.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication, redisUrl: string) {
    super(app);
    const pubClient = this.createRedisClient(redisUrl);
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }

  private createRedisClient(url: string): Redis {
    return new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    });
  }
}
