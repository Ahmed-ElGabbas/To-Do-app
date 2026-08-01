import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeamRole } from '../../../common/constants/team-role.enum';

/**
 * A user's membership in a team. One row per (team, user); the owner holds the
 * OWNER role and is created together with the team. Members beyond the owner
 * default to VIEWER and are promoted by the team owner.
 */
@Entity('team_members')
@Index(['teamId', 'userId'], { unique: true })
export class TeamMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20, default: TeamRole.VIEWER })
  role: TeamRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
