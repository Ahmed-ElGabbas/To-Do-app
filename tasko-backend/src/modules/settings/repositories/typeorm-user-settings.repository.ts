import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLanguage } from '../../../common/constants/app-language.enum';
import { UserSettingsEntity } from '../entities/user-settings.entity';
import { UserSettingsRepository } from '../interfaces/user-settings-repository';

@Injectable()
export class TypeOrmUserSettingsRepository extends UserSettingsRepository {
  constructor(
    @InjectRepository(UserSettingsEntity)
    private readonly repo: Repository<UserSettingsEntity>,
  ) {
    super();
  }

  findByUserId(userId: string): Promise<UserSettingsEntity | null> {
    return this.repo.findOne({ where: { userId } });
  }

  create(data: {
    userId: string;
    darkMode: boolean;
    notificationsEnabled: boolean;
    language: AppLanguage;
  }): Promise<UserSettingsEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: UserSettingsEntity): Promise<UserSettingsEntity> {
    return this.repo.save(entity);
  }
}
