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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { RevokeDeviceDto } from '../dto/revoke-device.dto';
import { DeviceTokenService } from '../services/device-token.service';
import { NotificationService } from '../services/notification.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly devices: DeviceTokenService,
  ) {}

  @ApiOperation({ summary: 'List notifications' })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.list(user.id, query);
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'List registered devices' })
  @Get('devices')
  listDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.devices.list(user.id);
  }

  @ApiOperation({ summary: 'Register a push notification device' })
  @Post('devices')
  registerDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devices.register(user.id, dto);
  }

  @ApiOperation({ summary: 'Revoke a push notification device' })
  @Delete('devices')
  revokeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RevokeDeviceDto,
  ) {
    return this.devices.revoke(user.id, dto.token);
  }
}
