import { Injectable } from '@nestjs/common';
import { AppLanguage } from '../../../common/constants/app-language.enum';
import { UserSettingsEntity } from '../entities/user-settings.entity';
import { UserSettingsRepository } from '../interfaces/user-settings-repository';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { SettingsOutput } from '../dto/settings.output';

const DEFAULTS = {
  darkMode: false,
  notificationsEnabled: true,
  language: AppLanguage.EN,
};

@Injectable()
export class SettingsService {
  constructor(private readonly settings: UserSettingsRepository) {}

  async getOrCreate(userId: string): Promise<SettingsOutput> {
    return this.toOutput(await this.getOrCreateRow(userId));
  }

  async update(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<SettingsOutput> {
    const row = await this.getOrCreateRow(userId);
    if (dto.darkMode !== undefined) {
      row.darkMode = dto.darkMode;
    }
    if (dto.notificationsEnabled !== undefined) {
      row.notificationsEnabled = dto.notificationsEnabled;
    }
    if (dto.language !== undefined) {
      row.language = dto.language;
    }
    return this.toOutput(await this.settings.save(row));
  }

  /** Upserts lazily so GET is always deterministic for a user. */
  private async getOrCreateRow(userId: string): Promise<UserSettingsEntity> {
    const existing = await this.settings.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.settings.create({ userId, ...DEFAULTS });
  }

  private toOutput(settings: UserSettingsEntity): SettingsOutput {
    return {
      userId: settings.userId,
      darkMode: settings.darkMode,
      notificationsEnabled: settings.notificationsEnabled,
      language: settings.language,
      updatedAt: settings.updatedAt,
    };
  }
}
