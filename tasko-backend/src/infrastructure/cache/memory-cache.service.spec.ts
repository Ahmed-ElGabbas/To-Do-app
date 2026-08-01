import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService', () => {
  let cache: MemoryCacheService;

  beforeEach(() => {
    cache = new MemoryCacheService(1);
  });

  afterEach(() => {
    cache.onApplicationShutdown();
  });

  it('stores and returns values', async () => {
    await cache.set('key', { hello: 'world' });
    await expect(cache.get('key')).resolves.toEqual({ hello: 'world' });
  });

  it('returns null for missing keys', async () => {
    await expect(cache.get('missing')).resolves.toBeNull();
  });

  it('expires entries after ttl', async () => {
    await cache.set('short', 'x', 1);
    await new Promise((resolve) => setTimeout(resolve, 1050));
    await expect(cache.get('short')).resolves.toBeNull();
  });

  it('deletes keys', async () => {
    await cache.set('k', 'v');
    await cache.delete('k');
    await expect(cache.get('k')).resolves.toBeNull();
  });

  it('always pings up', async () => {
    await expect(cache.ping()).resolves.toBe(true);
  });
});
