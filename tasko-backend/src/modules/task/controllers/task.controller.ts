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
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskListQueryDto } from '../dto/task-list-query.dto';
import { ToggleDoneDto } from '../dto/toggle-done.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskQueryService } from '../services/task-query.service';
import { TaskService } from '../services/task.service';

@ApiTags('tasks')
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskQuery: TaskQueryService,
  ) {}

  @ApiOperation({ summary: 'Create a personal task' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.taskService.create(user.id, dto);
  }

  @ApiOperation({ summary: 'List personal tasks' })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TaskListQueryDto,
  ) {
    return this.taskQuery.list(user.id, query);
  }

  @ApiOperation({ summary: 'Get a personal task' })
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskQuery.get(user.id, id);
  }

  @ApiOperation({ summary: 'Update a personal task' })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Toggle done state of a personal task' })
  @Patch(':id/done')
  toggleDone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleDoneDto,
  ) {
    return this.taskService.toggleDone(user.id, id, dto.isDone);
  }

  @ApiOperation({ summary: 'Delete a personal task' })
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskService.remove(user.id, id);
  }
}
