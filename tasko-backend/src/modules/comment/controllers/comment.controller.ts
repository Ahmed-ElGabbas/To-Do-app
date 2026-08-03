import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { CommentService } from '../services/comment.service';

/**
 * Comments on tasks. Task access is enforced per-request in the service
 * (personal ownership or team membership); the task routes are team-agnostic
 * so the service resolves the tenant from the task row itself.
 */
@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('tasks/:taskId/comments')
  create(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.create(taskId, user.id, dto);
  }

  @Get('tasks/:taskId/comments')
  list(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentService.list(taskId, user.id);
  }

  @Patch('comments/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.update(id, user.id, dto);
  }

  @Delete('comments/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentService.remove(id, user.id);
  }
}
