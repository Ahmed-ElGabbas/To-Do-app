import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { CacheService } from './cache.service';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Process-local cache used when no Redis is configured (local, test, and any
 * deployment without REDIS_URL). Entries are lazily evicted on access and
 * periodically pruned so expired keys never accumulate.
 */
@Injectable()
export class MemoryCacheService
  extends CacheService
  implements OnApplicationShutdown
{
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly pruneTimer: NodeJS.Timeout;

  constructor(private readonly defaultTtlSeconds = 300) {
    super();
    this.pruneTimer = setInterval(() => this.prune(), 60_000);
    this.pruneTimer.unref();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  onApplicationShutdown(): void {
    clearInterval(this.pruneTimer);
    this.store.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
