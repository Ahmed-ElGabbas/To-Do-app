import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { SettingsService } from '../services/settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getOrCreate(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.update(user.id, dto);
  }
}
