import { Test } from '@nestjs/testing';
import { LoggerService } from '../../common/logger/logger.service';
import { DeviceTokenRepository } from '../../modules/notification/interfaces/device-token-repository';
import { PushMessage } from '../push/push.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { FcmPushService } from './fcm-push.service';

const MESSAGE: PushMessage = {
  deviceTokens: ['token-a', 'token-b'],
  title: 'Task created',
  body: '"Buy milk" was added.',
  data: { notificationId: 'n1', taskId: 't1' },
};

describe('FcmPushService', () => {
  const firebase = { getMessaging: jest.fn() };
  const devices = { removeByTokens: jest.fn() };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };
  const messaging = { sendEachForMulticast: jest.fn() };

  let service: FcmPushService;

  beforeEach(async () => {
    jest.clearAllMocks();
    firebase.getMessaging.mockReturnValue(messaging);

    const moduleRef = await Test.createTestingModule({
      providers: [
        FcmPushService,
        { provide: FirebaseAdminService, useValue: firebase },
        { provide: DeviceTokenRepository, useValue: devices },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();
    service = moduleRef.get(FcmPushService);
  });

  it('sends one multicast and logs delivery', async () => {
    messaging.sendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });

    await service.send(MESSAGE);

    expect(firebase.getMessaging).toHaveBeenCalled();
    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: MESSAGE.deviceTokens,
      notification: { title: MESSAGE.title, body: MESSAGE.body },
      data: MESSAGE.data,
    });
    expect(devices.removeByTokens).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('fcm_sent', {
      success: 2,
      failure: 0,
      notificationId: 'n1',
    });
  });

  it('deletes device rows for unregistered tokens', async () => {
    messaging.sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });

    await service.send(MESSAGE);

    expect(devices.removeByTokens).toHaveBeenCalledWith(['token-b']);
    expect(logger.info).toHaveBeenCalledWith(
      'fcm_unregistered_tokens_removed',
      {
        removed: 1,
        notificationId: 'n1',
      },
    );
  });

  it('swallows send failures so notification writes never break', async () => {
    messaging.sendEachForMulticast.mockRejectedValue(new Error('fcm down'));

    await expect(service.send(MESSAGE)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'fcm_send_failed',
      expect.objectContaining({ notificationId: 'n1' }),
    );
  });

  it('skips empty token lists without touching FCM', async () => {
    await service.send({ ...MESSAGE, deviceTokens: [] });

    expect(firebase.getMessaging).not.toHaveBeenCalled();
    expect(devices.removeByTokens).not.toHaveBeenCalled();
  });
});
