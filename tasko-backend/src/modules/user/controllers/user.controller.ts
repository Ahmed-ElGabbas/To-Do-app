import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Role } from '../../../common/constants/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserService } from '../user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getProfile(user.id);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getProfile(id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }
}
