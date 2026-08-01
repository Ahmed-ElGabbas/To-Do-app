import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './controllers/settings.controller';
import { UserSettingsEntity } from './entities/user-settings.entity';
import { UserSettingsRepository } from './interfaces/user-settings-repository';
import { TypeOrmUserSettingsRepository } from './repositories/typeorm-user-settings.repository';
import { SettingsService } from './services/settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettingsEntity])],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    {
      provide: UserSettingsRepository,
      useClass: TypeOrmUserSettingsRepository,
    },
  ],
  exports: [UserSettingsRepository],
})
export class SettingsModule {}
