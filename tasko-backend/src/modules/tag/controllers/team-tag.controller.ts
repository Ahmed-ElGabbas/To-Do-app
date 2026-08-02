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
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { TagService } from '../services/tag.service';

/**
 * Team-scoped tag routes. Any team member may read; writes require `editor` or
 * higher (enforced by TeamMembershipGuard via @RequireTeamRole).
 */
@Controller('teams/:teamId/tags')
export class TeamTagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @RequireTeamRole()
  list(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.tagService.listForTeam(teamId);
  }

  @Post()
  @RequireTeamRole(TeamRole.EDITOR)
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTagDto,
  ) {
    return this.tagService.createInTeam(teamId, user.id, dto);
  }

  @Get(':id')
  @RequireTeamRole()
  get(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tagService.getInTeam(teamId, id);
  }

  @Patch(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  update(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagService.updateInTeam(teamId, id, dto);
  }

  @Delete(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tagService.removeFromTeam(teamId, id);
  }
}
