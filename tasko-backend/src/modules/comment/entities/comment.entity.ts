import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskEntity } from '../../task/entities/task.entity';

/**
 * A comment on a task. Comments belong to a task row and are deleted with it;
 * `userId` is the author and is denormalized (no FK, mirroring the task/user
 * relationship) so the tenant-scoped access checks stay plain column reads.
 */
@Entity('comments')
@Index(['taskId'])
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
