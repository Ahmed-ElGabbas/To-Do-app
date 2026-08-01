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
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { TeamService } from '../services/team.service';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teamService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.teamService.list(user.id);
  }

  @Get(':teamId')
  @RequireTeamRole()
  get(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.teamService.get(teamId);
  }

  @Patch(':teamId')
  @RequireTeamRole(TeamRole.OWNER)
  update(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamService.update(teamId, dto);
  }

  @Delete(':teamId')
  @RequireTeamRole(TeamRole.OWNER)
  remove(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.teamService.remove(teamId);
  }
}
