import { DevicePlatform } from '../constants/device-platform.enum';
import { UserDeviceEntity } from '../entities/user-device.entity';

export interface CreateDeviceData {
  userId: string;
  token: string;
  platform: DevicePlatform | null;
}

/** Data access contract for per-user push device tokens. */
export abstract class DeviceTokenRepository {
  abstract findByToken(token: string): Promise<UserDeviceEntity | null>;

  abstract findByUser(userId: string): Promise<UserDeviceEntity[]>;

  abstract create(data: CreateDeviceData): Promise<UserDeviceEntity>;

  abstract save(entity: UserDeviceEntity): Promise<UserDeviceEntity>;

  abstract remove(entity: UserDeviceEntity): Promise<void>;

  /** Deletes every device whose token is in the given set; returns the count removed. */
  abstract removeByTokens(tokens: string[]): Promise<number>;
}
