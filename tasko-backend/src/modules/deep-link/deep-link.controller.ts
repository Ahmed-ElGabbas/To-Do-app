import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { DeepLinkService } from './deep-link.service';

/**
 * Serves the platform association files required for Android App Links and iOS
 * Universal Links. Like the health probes these routes are `@Public` and
 * `@SkipTransform`: verification crawlers expect a flat, framework-standard
 * body at `https://<host>/.well-known/...`, not the API's JSON envelope.
 */
@ApiTags('deep-link')
@Controller('.well-known')
export class DeepLinkController {
  constructor(private readonly deepLinkService: DeepLinkService) {}

  @Public()
  @SkipTransform()
  @ApiOperation({ summary: 'Android App Links association file' })
  @Get('assetlinks.json')
  assetLinks() {
    return this.deepLinkService.assetLinks();
  }

  @Public()
  @SkipTransform()
  @ApiOperation({ summary: 'Apple Universal Links association file' })
  @Get('apple-app-site-association')
  appleAppSiteAssociation() {
    return this.deepLinkService.appleAppSiteAssociation();
  }
}
