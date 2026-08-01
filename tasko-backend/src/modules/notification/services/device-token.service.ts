import { Injectable } from '@nestjs/common';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { DeviceOutput } from '../dto/device.output';
import { UserDeviceEntity } from '../entities/user-device.entity';
import { DeviceTokenRepository } from '../interfaces/device-token-repository';

/**
 * Manages the push device tokens registered per user. Registering a token that
 * already exists re-assigns it to the caller (devices move between accounts);
 * revocation is idempotent so a logged-out client can retry safely.
 */
@Injectable()
export class DeviceTokenService {
  constructor(private readonly devices: DeviceTokenRepository) {}

  async register(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceOutput> {
    const existing = await this.devices.findByToken(dto.token);
    if (existing) {
      if (existing.userId !== userId) {
        existing.userId = userId;
      }
      if (dto.platform !== undefined) {
        existing.platform = dto.platform;
      }
      return this.toOutput(await this.devices.save(existing));
    }
    return this.toOutput(
      await this.devices.create({
        userId,
        token: dto.token,
        platform: dto.platform ?? null,
      }),
    );
  }

  async revoke(userId: string, token: string): Promise<void> {
    const device = await this.devices.findByToken(token);
    if (device && device.userId === userId) {
      await this.devices.remove(device);
    }
  }

  async list(userId: string): Promise<DeviceOutput[]> {
    const devices = await this.devices.findByUser(userId);
    return devices.map((device) => this.toOutput(device));
  }

  private toOutput(device: UserDeviceEntity): DeviceOutput {
    return {
      id: device.id,
      token: device.token,
      platform: device.platform,
      createdAt: device.createdAt,
    };
  }
}
