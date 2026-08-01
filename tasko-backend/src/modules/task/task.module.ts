import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEventsModule } from '../../infrastructure/events/task-events.module';
import { CategoryModule } from '../category/category.module';
import { TagModule } from '../tag/tag.module';
import { TaskController } from './controllers/task.controller';
import { TaskEntity } from './entities/task.entity';
import { TaskRepository } from './interfaces/task-repository';
import { TypeOrmTaskRepository } from './repositories/typeorm-task.repository';
import { TaskQueryService } from './services/task-query.service';
import { TaskService } from './services/task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    CategoryModule,
    TagModule,
    TaskEventsModule,
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskQueryService,
    { provide: TaskRepository, useClass: TypeOrmTaskRepository },
  ],
})
export class TaskModule {}
