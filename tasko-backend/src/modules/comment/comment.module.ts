import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberModule } from '../member/member.module';
import { TaskModule } from '../task/task.module';
import { CommentController } from './controllers/comment.controller';
import { CommentEntity } from './entities/comment.entity';
import { CommentRepository } from './interfaces/comment-repository';
import { TypeOrmCommentRepository } from './repositories/typeorm-comment.repository';
import { CommentService } from './services/comment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommentEntity]),
    TaskModule,
    MemberModule,
  ],
  controllers: [CommentController],
  providers: [
    CommentService,
    { provide: CommentRepository, useClass: TypeOrmCommentRepository },
  ],
})
export class CommentModule {}
