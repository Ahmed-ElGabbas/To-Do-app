import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireTeamRole } from '../../../common/decorators/require-team-role.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryService } from '../services/category.service';

/**
 * Team-scoped category routes. Any team member may read; writes require
 * `editor` or higher (enforced by TeamMembershipGuard via @RequireTeamRole).
 */
@Controller('teams/:teamId/categories')
export class TeamCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @RequireTeamRole()
  list(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.categoryService.listForTeam(teamId);
  }

  @Post()
  @RequireTeamRole(TeamRole.EDITOR)
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoryService.createInTeam(teamId, user.id, dto);
  }

  @Get(':id')
  @RequireTeamRole()
  get(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoryService.getInTeam(teamId, id);
  }

  @Patch(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  update(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateInTeam(teamId, id, dto);
  }

  @Delete(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoryService.removeFromTeam(teamId, id);
  }
}
