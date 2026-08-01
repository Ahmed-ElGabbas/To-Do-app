import { Test } from '@nestjs/testing';
import { DevicePlatform } from '../constants/device-platform.enum';
import { DeviceTokenRepository } from '../interfaces/device-token-repository';
import { DeviceTokenService } from './device-token.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const baseDevice = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: OWNER,
  token: 'push-token-a',
  platform: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DeviceTokenService', () => {
  const devices = {
    findByToken: jest.fn(),
    findByUser: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  let service: DeviceTokenService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeviceTokenService,
        { provide: DeviceTokenRepository, useValue: devices },
      ],
    }).compile();
    service = moduleRef.get(DeviceTokenService);
  });

  describe('register', () => {
    it('creates a new device for an unknown token', async () => {
      devices.findByToken.mockResolvedValue(null);
      devices.create.mockResolvedValue(baseDevice);

      const result = await service.register(OWNER, {
        token: 'push-token-a',
        platform: DevicePlatform.ANDROID,
      });

      expect(devices.create).toHaveBeenCalledWith({
        userId: OWNER,
        token: 'push-token-a',
        platform: DevicePlatform.ANDROID,
      });
      expect(result.token).toBe('push-token-a');
    });

    it('re-assigns an existing token when it moves to another account', async () => {
      devices.findByToken.mockResolvedValue({ ...baseDevice, userId: OTHER });
      devices.save.mockResolvedValue({ ...baseDevice, userId: OWNER });

      const result = await service.register(OWNER, { token: 'push-token-a' });

      expect(devices.create).not.toHaveBeenCalled();
      expect(devices.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: OWNER }),
      );
      expect(result.token).toBe('push-token-a');
    });

    it('keeps the owner and updates the platform when re-registered', async () => {
      devices.findByToken.mockResolvedValue({ ...baseDevice });
      devices.save.mockResolvedValue({
        ...baseDevice,
        platform: DevicePlatform.WEB,
      });

      const result = await service.register(OWNER, {
        token: 'push-token-a',
        platform: DevicePlatform.WEB,
      });

      expect(devices.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: OWNER,
          platform: DevicePlatform.WEB,
        }),
      );
      expect(result.platform).toBe(DevicePlatform.WEB);
    });
  });

  describe('revoke', () => {
    it('removes an owned device', async () => {
      devices.findByToken.mockResolvedValue(baseDevice);

      await service.revoke(OWNER, 'push-token-a');

      expect(devices.remove).toHaveBeenCalledWith(baseDevice);
    });

    it('ignores tokens owned by another user', async () => {
      devices.findByToken.mockResolvedValue({ ...baseDevice, userId: OTHER });

      await service.revoke(OWNER, 'push-token-a');

      expect(devices.remove).not.toHaveBeenCalled();
    });

    it('is idempotent for an unknown token', async () => {
      devices.findByToken.mockResolvedValue(null);

      await expect(service.revoke(OWNER, 'unknown')).resolves.toBeUndefined();
      expect(devices.remove).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns only the caller-owned devices', async () => {
      devices.findByUser.mockResolvedValue([baseDevice]);

      const result = await service.list(OWNER);

      expect(devices.findByUser).toHaveBeenCalledWith(OWNER);
      expect(result).toEqual([
        expect.objectContaining({ token: 'push-token-a' }),
      ]);
    });
  });
});
