import { AppLanguage } from '../../../common/constants/app-language.enum';
import { UserSettingsEntity } from '../entities/user-settings.entity';

/** Data access contract for per-user settings. */
export abstract class UserSettingsRepository {
  abstract findByUserId(userId: string): Promise<UserSettingsEntity | null>;

  abstract create(data: {
    userId: string;
    darkMode: boolean;
    notificationsEnabled: boolean;
    language: AppLanguage;
  }): Promise<UserSettingsEntity>;

  abstract save(entity: UserSettingsEntity): Promise<UserSettingsEntity>;
}
