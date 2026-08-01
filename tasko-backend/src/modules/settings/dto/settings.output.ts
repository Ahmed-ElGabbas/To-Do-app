import { AppLanguage } from '../../../common/constants/app-language.enum';

/** Response shape for user settings. Whitelisted by construction. */
export interface SettingsOutput {
  userId: string;
  darkMode: boolean;
  notificationsEnabled: boolean;
  language: AppLanguage;
  updatedAt: Date;
}
