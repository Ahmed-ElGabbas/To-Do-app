import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @SkipTransform()
  @ApiOperation({ summary: 'Liveness probe' })
  @Get()
  liveness(): { status: 'ok' } {
    return this.healthService.liveness();
  }

  @Public()
  @SkipTransform()
  @ApiOperation({ summary: 'Readiness probe' })
  @Get('ready')
  async readiness() {
    const report = await this.healthService.readiness();
    if (report.status !== 'ready') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
