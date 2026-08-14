import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RealtimeRateLimiter } from '../interfaces/realtime-rate-limiter';

interface Window {
  windowStart: number;
  count: number;
}

/**
 * In-memory fixed-window limiter: `Map<userId, { windowStart, count }>`. Each
 * `allow` lazily sweeps its own window (an expired window resets to one), so
 * stale entries need no background timer; `disconnect` removes the entry
 * entirely. Budget comes from `realtime.eventRateLimit` (default 60) per
 * `realtime.eventRateTtlMs` (default 30 s), exactly the R0 config vars.
 */
@Injectable()
export class InMemoryRealtimeRateLimiter extends RealtimeRateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly limit: number;
  private readonly ttlMs: number;

  constructor(config: ConfigService) {
    super();
    this.limit = config.get<number>('realtime.eventRateLimit', 60) ?? 60;
    this.ttlMs = config.get<number>('realtime.eventRateTtlMs', 30000) ?? 30000;
  }

  allow(userId: string, now = Date.now()): boolean {
    const entry = this.windows.get(userId);
    if (!entry || now - entry.windowStart >= this.ttlMs) {
      this.windows.set(userId, { windowStart: now, count: 1 });
      return true;
    }
    if (entry.count >= this.limit) {
      return false;
    }
    entry.count += 1;
    return true;
  }

  disconnect(userId: string): void {
    this.windows.delete(userId);
  }
}
