import { CommentEntity } from '../entities/comment.entity';

/** Whitelisted comment projection returned to API clients. */
export interface CommentOutput {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toCommentOutput(comment: CommentEntity): CommentOutput {
  return {
    id: comment.id,
    taskId: comment.taskId,
    userId: comment.userId,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}
