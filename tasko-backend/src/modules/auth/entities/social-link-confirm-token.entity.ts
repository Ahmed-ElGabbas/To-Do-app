import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One-time email token confirming that a Facebook sign-in matched an existing
 * account whose owner cannot prove possession with a password (passwordless
 * accounts). Binds the pending provider identity (`provider_account_id`, the
 * Firebase `sub`) so that clicking the emailed link can persist the link.
 */
@Entity('social_link_confirm_tokens')
export class SocialLinkConfirmTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** SHA-256 hash of the raw one-time confirmation token. */
  @Column({ name: 'token_hash', length: 64, unique: true })
  tokenHash: string;

  /** Social provider being confirmed (always `facebook` for now). */
  @Column({ type: 'varchar', length: 20 })
  provider: string;

  /** Provider account id to bind once confirmed (the Firebase `sub`). */
  @Column({ name: 'provider_account_id', length: 255 })
  providerAccountId: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: 'datetime', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
