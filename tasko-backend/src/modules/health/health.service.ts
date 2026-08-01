import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { MailerService } from '../../infrastructure/mailer/mailer.service';

export interface DependencyHealth {
  status: 'up' | 'down';
  detail?: string;
}

export interface ReadinessReport {
  status: 'ready' | 'degraded';
  checks: Record<string, DependencyHealth>;
}

/**
 * Readiness probe. Each dependency is checked independently and the report is
 * aggregated rather than short-circuited so a partially-degraded service still
 * reports everything wrong at once.
 */
@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
    private readonly mailerService: MailerService,
  ) {}

  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async readiness(): Promise<ReadinessReport> {
    const [database, cache, queue, mailer] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkQueue(),
      this.checkMailer(),
    ]);
    const checks = { database, cache, queue, mailer };
    const allUp = Object.values(checks).every((c) => c.status === 'up');
    return { status: allUp ? 'ready' : 'degraded', checks };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (err) {
      return { status: 'down', detail: this.errorMessage(err) };
    }
  }

  private async checkCache(): Promise<DependencyHealth> {
    try {
      return (await this.cacheService.ping())
        ? { status: 'up' }
        : { status: 'down' };
    } catch (err) {
      return { status: 'down', detail: this.errorMessage(err) };
    }
  }

  private async checkQueue(): Promise<DependencyHealth> {
    try {
      return (await this.queueService.isHealthy())
        ? { status: 'up' }
        : { status: 'down' };
    } catch (err) {
      return { status: 'down', detail: this.errorMessage(err) };
    }
  }

  private async checkMailer(): Promise<DependencyHealth> {
    try {
      const probe = await this.mailerService.probe();
      return probe ? { status: 'up' } : { status: 'down' };
    } catch (err) {
      return { status: 'down', detail: this.errorMessage(err) };
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
