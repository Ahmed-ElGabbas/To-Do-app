import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @SkipTransform()
  @Get()
  liveness(): { status: 'ok' } {
    return this.healthService.liveness();
  }

  @Public()
  @SkipTransform()
  @Get('ready')
  async readiness() {
    const report = await this.healthService.readiness();
    if (report.status !== 'ready') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
