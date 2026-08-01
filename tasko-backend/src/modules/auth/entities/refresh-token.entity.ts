import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** SHA-256 hash of the raw refresh token. The raw token is never stored. */
  @Column({ name: 'token_hash', length: 64, unique: true })
  tokenHash: string;

  /**
   * All rotated tokens from one login share a family. If a rotated/revoked
   * token is ever reused, the whole family is revoked (theft signal).
   */
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
