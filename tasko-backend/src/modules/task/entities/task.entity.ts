import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import { TeamEntity } from '../../team/entities/team.entity';
import { CategoryEntity } from '../../category/entities/category.entity';
import { TagEntity } from '../../tag/entities/tag.entity';

/**
 * A user-owned task. The id is normally supplied by the Tasko client (UUID v4)
 * so optimistic updates stay idempotent; the server generates one only when
 * omitted. `date` keeps the client's raw label (`today` | `tomorrow` |
 * `yyyy-MM-dd`) so it round-trips losslessly.
 *
 * A task is either personal (`teamId` IS NULL) or team-scoped (`teamId` set).
 * Personal tasks are visible only to their owner; team tasks are visible to
 * every team member.
 */
@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Set for team-scoped tasks; NULL for personal tasks. */
  @Index()
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: TeamEntity | null;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 12 })
  time: string;

  @Column({ length: 10 })
  date: string;

  @Column({ name: 'is_done', default: false })
  isDone: boolean;

  /** When the task was last marked done (NULL while pending/reopened). */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity | null;

  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'task_tags',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: TagEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
