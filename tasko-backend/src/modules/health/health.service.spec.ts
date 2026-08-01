import type { CacheService } from '../../infrastructure/cache/cache.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const dataSource = { query: jest.fn() };
  const cacheService = { ping: jest.fn() } as unknown as CacheService;
  const queueService = { isHealthy: jest.fn() };
  const mailerService = { probe: jest.fn() };

  let service: HealthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new HealthService(
      dataSource as never,
      cacheService,
      queueService as never,
      mailerService as never,
    );
  });

  it('reports liveness without touching dependencies', () => {
    expect(service.liveness()).toEqual({ status: 'ok' });
  });

  it('is ready when every dependency is up', async () => {
    dataSource.query.mockResolvedValue([{ '1': 1 }]);
    cacheService.ping.mockResolvedValue(true);
    queueService.isHealthy.mockResolvedValue(true);
    mailerService.probe.mockResolvedValue(true);

    const report = await service.readiness();
    expect(report.status).toBe('ready');
    expect(Object.values(report.checks).every((c) => c.status === 'up')).toBe(
      true,
    );
  });

  it('degrades when the database is down', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));
    cacheService.ping.mockResolvedValue(true);
    queueService.isHealthy.mockResolvedValue(true);
    mailerService.probe.mockResolvedValue(true);

    const report = await service.readiness();
    expect(report.status).toBe('degraded');
    const db = report.checks.database;
    expect(db.status).toBe('down');
    expect(db.detail).toBe('connection refused');
  });

  it('still checks every dependency when one is down', async () => {
    dataSource.query.mockRejectedValue(new Error('db down'));
    cacheService.ping.mockResolvedValue(false);

    const report = await service.readiness();
    expect(report.status).toBe('degraded');
    expect(report.checks.database.status).toBe('down');
    expect(report.checks.cache.status).toBe('down');
  });
});
