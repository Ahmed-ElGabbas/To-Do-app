import { Injectable } from '@nestjs/common';
import type { SendResponse } from 'firebase-admin/messaging';
import { LoggerService } from '../../common/logger/logger.service';
import { DeviceTokenRepository } from '../../modules/notification/interfaces/device-token-repository';
import { PushMessage, PushService } from '../push/push.service';
import { FirebaseAdminService } from './firebase-admin.service';

/** FCM error codes that mean a registration token is no longer deliverable. */
const UNREGISTERED_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/device-not-registered',
]);

/**
 * Firebase Cloud Messaging push provider. Sends one multicast per message and
 * prunes device rows whose registration tokens FCM reports as invalid so stale
 * tokens never accumulate. Delivery failures are logged and swallowed: push
 * must never make the originating notification write fail.
 */
@Injectable()
export class FcmPushService extends PushService {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly devices: DeviceTokenRepository,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext('Push');
  }

  async send(message: PushMessage): Promise<void> {
    if (message.deviceTokens.length === 0) {
      return;
    }

    try {
      const result = await this.firebase.getMessaging().sendEachForMulticast({
        tokens: message.deviceTokens,
        notification: { title: message.title, body: message.body },
        data: message.data,
      });

      const invalidTokens = message.deviceTokens.filter((_, index) =>
        this.isUnregisteredToken(result.responses[index]),
      );
      if (invalidTokens.length > 0) {
        await this.devices.removeByTokens(invalidTokens);
        this.logger.info('fcm_unregistered_tokens_removed', {
          removed: invalidTokens.length,
          notificationId: message.data?.notificationId,
        });
      }

      this.logger.info('fcm_sent', {
        success: result.successCount,
        failure: result.failureCount,
        notificationId: message.data?.notificationId,
      });
    } catch (error) {
      this.logger.error('fcm_send_failed', {
        message: error instanceof Error ? error.message : 'FCM send failed',
        notificationId: message.data?.notificationId,
      });
    }
  }

  private isUnregisteredToken(response: SendResponse): boolean {
    return UNREGISTERED_TOKEN_CODES.has(response.error?.code ?? '');
  }
}
