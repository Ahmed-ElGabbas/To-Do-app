import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword: string;
}
