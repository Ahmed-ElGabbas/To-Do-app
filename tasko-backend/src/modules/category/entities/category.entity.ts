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
import { TeamEntity } from '../../team/entities/team.entity';

/**
 * A single-select task classifier. A category is either personal
 * (`teamId` IS NULL, owned by `userId`) or team-scoped (`teamId` set, visible
 * to every team member). Uniqueness is per scope: personal names are unique
 * per user, team names are unique per team.
 */
@Entity('categories')
@Index(['userId', 'name'], { unique: true, where: 'team_id IS NULL' })
@Index(['teamId', 'name'], { unique: true, where: 'team_id IS NOT NULL' })
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Set for team-scoped categories; NULL for personal ones. */
  @Index()
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: TeamEntity | null;

  @Column({ length: 50 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
