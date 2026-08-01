import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { RevokeDeviceDto } from '../dto/revoke-device.dto';
import { DeviceTokenService } from '../services/device-token.service';
import { NotificationService } from '../services/notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly devices: DeviceTokenService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.list(user.id, query);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Get('devices')
  listDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.devices.list(user.id);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devices.register(user.id, dto);
  }

  @Delete('devices')
  revokeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RevokeDeviceDto,
  ) {
    return this.devices.revoke(user.id, dto.token);
  }
}
