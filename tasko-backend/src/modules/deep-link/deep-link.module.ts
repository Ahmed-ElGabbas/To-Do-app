import { Module } from '@nestjs/common';
import { DeepLinkController } from './deep-link.controller';
import { DeepLinkService } from './deep-link.service';
import { LandingPageService } from './landing-page.service';

@Module({
  controllers: [DeepLinkController],
  providers: [DeepLinkService, LandingPageService],
  exports: [DeepLinkService, LandingPageService],
})
export class DeepLinkModule {}
