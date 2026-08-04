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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
@ApiTags('team-tags')
@Controller('teams/:teamId/tags')
export class TeamTagController {
  constructor(private readonly tagService: TagService) {}

  @ApiOperation({ summary: 'List team tags' })
  @Get()
  @RequireTeamRole()
  list(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.tagService.listForTeam(teamId);
  }

  @ApiOperation({ summary: 'Create a team tag (editor or owner)' })
  @Post()
  @RequireTeamRole(TeamRole.EDITOR)
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTagDto,
  ) {
    return this.tagService.createInTeam(teamId, user.id, dto);
  }

  @ApiOperation({ summary: 'Get a team tag' })
  @Get(':id')
  @RequireTeamRole()
  get(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tagService.getInTeam(teamId, id);
  }

  @ApiOperation({ summary: 'Update a team tag (editor or owner)' })
  @Patch(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  update(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagService.updateInTeam(teamId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a team tag (editor or owner)' })
  @Delete(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tagService.removeFromTeam(teamId, id);
  }
}
