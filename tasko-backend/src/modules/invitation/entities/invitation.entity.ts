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
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamEntity } from '../../team/entities/team.entity';
import { InvitationStatus } from '../constants/invitation-status.enum';

/**
 * An e-mail invitation to join a team. Only the SHA-256 `tokenHash` is stored;
 * the raw token travels in the e-mail link and is never persisted. The invite
 * is single-use and expires (`expiresAt`), and the accept link may complete
 * registration (stub user) or link an existing account.
 */
@Entity('invitations')
@Index(['teamId', 'email'])
export class InvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => TeamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: TeamEntity;

  @Index()
  @Column({ length: 255 })
  email: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 20, default: TeamRole.VIEWER })
  role: TeamRole;

  @Column({
    type: 'varchar',
    length: 20,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Index()
  @Column({ name: 'invited_by', type: 'uuid' })
  invitedBy: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'datetime', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'declined_at', type: 'datetime', nullable: true })
  declinedAt: Date | null;

  /** User linked on acceptance (an existing account or a stub user). */
  @Column({ name: 'invited_user_id', type: 'uuid', nullable: true })
  invitedUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
