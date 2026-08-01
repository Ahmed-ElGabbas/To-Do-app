import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RevokeDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}
