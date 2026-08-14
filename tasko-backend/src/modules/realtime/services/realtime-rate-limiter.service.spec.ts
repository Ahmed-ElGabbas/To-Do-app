import { ConfigService } from '@nestjs/config';
import { InMemoryRealtimeRateLimiter } from './realtime-rate-limiter.service';

const USER = '11111111-1111-4111-8111-111111111111';
const NOW = 1_000_000_000_000;
const TTL_MS = 30_000;

describe('InMemoryRealtimeRateLimiter', () => {
  function makeLimiter(limit = 3): InMemoryRealtimeRateLimiter {
    const config = {
      get: jest.fn((key: string, fallback: number) =>
        key === 'realtime.eventRateLimit' ? limit : fallback,
      ),
    };
    return new InMemoryRealtimeRateLimiter(config as unknown as ConfigService);
  }

  it('allows messages up to the configured budget per window', () => {
    const limiter = makeLimiter(3);
    expect(limiter.allow(USER, NOW)).toBe(true);
    expect(limiter.allow(USER, NOW)).toBe(true);
    expect(limiter.allow(USER, NOW)).toBe(true);
    expect(limiter.allow(USER, NOW)).toBe(false);
    expect(limiter.allow(USER, NOW)).toBe(false);
  });

  it('applies a separate window per user', () => {
    const limiter = makeLimiter(1);
    expect(limiter.allow(USER, NOW)).toBe(true);
    expect(limiter.allow(USER, NOW)).toBe(false);
    expect(limiter.allow('22222222-2222-4222-8222-222222222222', NOW)).toBe(
      true,
    );
  });

  it('resets the window after the TTL elapses', () => {
    const limiter = makeLimiter(1);
    expect(limiter.allow(USER, NOW)).toBe(true);
    expect(limiter.allow(USER, NOW + 1000)).toBe(false);
    expect(limiter.allow(USER, NOW + TTL_MS)).toBe(true);
  });

  it('starts fresh after disconnect', () => {
    const limiter = makeLimiter(1);
    expect(limiter.allow(USER, NOW)).toBe(true);
    expect(limiter.allow(USER, NOW)).toBe(false);
    limiter.disconnect(USER);
    expect(limiter.allow(USER, NOW)).toBe(true);
  });
});
