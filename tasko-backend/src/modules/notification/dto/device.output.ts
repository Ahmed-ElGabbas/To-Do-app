import { DevicePlatform } from '../constants/device-platform.enum';

/** Response shape for a registered device token. */
export interface DeviceOutput {
  id: string;
  token: string;
  platform: DevicePlatform | null;
  createdAt: Date;
}
