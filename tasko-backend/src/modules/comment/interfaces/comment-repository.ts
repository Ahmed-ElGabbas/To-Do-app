import { CommentEntity } from '../entities/comment.entity';

export interface CreateCommentData {
  taskId: string;
  userId: string;
  body: string;
}

/**
 * Data access contract for task comments. The concrete TypeORM implementation
 * lives in `repositories/`; the service only depends on this abstraction.
 */
export abstract class CommentRepository {
  abstract listByTask(taskId: string): Promise<CommentEntity[]>;

  abstract findById(id: string): Promise<CommentEntity | null>;

  abstract create(data: CreateCommentData): Promise<CommentEntity>;

  abstract save(entity: CommentEntity): Promise<CommentEntity>;

  abstract remove(id: string): Promise<void>;
}
