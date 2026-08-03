import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentEntity } from '../entities/comment.entity';
import { CommentRepository } from '../interfaces/comment-repository';

@Injectable()
export class TypeOrmCommentRepository extends CommentRepository {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly repo: Repository<CommentEntity>,
  ) {
    super();
  }

  listByTask(taskId: string): Promise<CommentEntity[]> {
    return this.repo.find({
      where: { taskId },
      order: { createdAt: 'ASC' },
    });
  }

  findById(id: string): Promise<CommentEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  create(data: {
    taskId: string;
    userId: string;
    body: string;
  }): Promise<CommentEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: CommentEntity): Promise<CommentEntity> {
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
