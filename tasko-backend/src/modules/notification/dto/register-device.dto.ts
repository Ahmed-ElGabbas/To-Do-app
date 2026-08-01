import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DevicePlatform } from '../constants/device-platform.enum';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;
}
