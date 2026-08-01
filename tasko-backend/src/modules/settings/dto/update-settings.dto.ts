import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { AppLanguage } from '../../../common/constants/app-language.enum';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsIn(Object.values(AppLanguage))
  language?: AppLanguage;
}
