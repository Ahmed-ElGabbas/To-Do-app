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
import { TeamRole } from '../../../common/constants/team-role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireTeamRole } from '../../../common/decorators/require-team-role.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskListQueryDto } from '../dto/task-list-query.dto';
import { ToggleDoneDto } from '../dto/toggle-done.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskQueryService } from '../services/task-query.service';
import { TaskService } from '../services/task.service';

/**
 * Team-scoped task routes. Access is gated by the global TeamMembershipGuard
 * via `@RequireTeamRole`: any team member may read, writes require `editor`
 * or higher. The caller's team role is resolved by the guard, never re-read
 * by the service.
 */
@Controller('teams/:teamId/tasks')
export class TeamTaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskQuery: TaskQueryService,
  ) {}

  @Get()
  @RequireTeamRole()
  list(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: TaskListQueryDto,
  ) {
    return this.taskQuery.listForTeam(teamId, query);
  }

  @Post()
  @RequireTeamRole(TeamRole.EDITOR)
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.createInTeam(teamId, user.id, dto);
  }

  @Get(':id')
  @RequireTeamRole()
  get(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskQuery.getTeam(teamId, id);
  }

  @Patch(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  update(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.updateInTeam(teamId, user.id, id, dto);
  }

  @Patch(':id/done')
  @RequireTeamRole(TeamRole.EDITOR)
  toggleDone(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleDoneDto,
  ) {
    return this.taskService.toggleDoneInTeam(teamId, user.id, id, dto.isDone);
  }

  @Delete(':id')
  @RequireTeamRole(TeamRole.EDITOR)
  remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskService.removeInTeam(teamId, user.id, id);
  }
}
