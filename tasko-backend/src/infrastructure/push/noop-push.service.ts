import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/logger/logger.service';
import { PushMessage, PushService } from './push.service';

/**
 * Placeholder push service used until a vendor is wired (Phase 1 has no push
 * producers). Logs the intended delivery so the flow is observable.
 */
@Injectable()
export class NoopPushService extends PushService {
  constructor(private readonly logger: LoggerService) {
    super();
    this.logger.setContext('Push');
  }

  async send(message: PushMessage): Promise<void> {
    this.logger.info('push_skipped', {
      deviceTokens: message.deviceTokens.length,
      title: message.title,
    });
  }
}
