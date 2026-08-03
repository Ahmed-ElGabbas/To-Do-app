import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '../../../common/constants/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { AdminListQueryDto } from '../dto/admin-list-query.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { AdminService } from '../services/admin.service';

/**
 * Platform administration. Every route requires the ADMIN role via the
 * class-level @Roles() (enforced by the global RolesGuard).
 */
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Get('users')
  listUsers(@Query() query: AdminListQueryDto) {
    return this.adminService.listUsers(
      query.q?.trim() || undefined,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  updateUserRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateRole(actor.id, id, dto.role);
  }

  @Get('teams')
  listTeams(@Query() query: AdminListQueryDto) {
    return this.adminService.listTeams(
      query.q?.trim() || undefined,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('teams/:id')
  getTeam(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getTeam(id);
  }
}
