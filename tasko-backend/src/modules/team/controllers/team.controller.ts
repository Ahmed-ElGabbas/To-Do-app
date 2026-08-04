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
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { TeamService } from '../services/team.service';

@ApiTags('teams')
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ApiOperation({ summary: 'Create a team (creator becomes owner)' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teamService.create(user.id, dto);
  }

  @ApiOperation({ summary: 'List the teams the user belongs to' })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.teamService.list(user.id);
  }

  @ApiOperation({ summary: 'Get a team detail' })
  @Get(':teamId')
  @RequireTeamRole()
  get(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.teamService.get(teamId);
  }

  @ApiOperation({ summary: 'Update a team (owner only)' })
  @Patch(':teamId')
  @RequireTeamRole(TeamRole.OWNER)
  update(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamService.update(teamId, dto);
  }

  @ApiOperation({ summary: 'Delete a team (owner only)' })
  @Delete(':teamId')
  @RequireTeamRole(TeamRole.OWNER)
  remove(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.teamService.remove(teamId);
  }
}
