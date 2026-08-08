import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FileKind } from '../../../common/constants/file-kind.enum';

/**
 * Metadata for a stored object. The bytes themselves live in object storage
 * (or local disk in dev) under `storageKey`.
 */
@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Owner of the file. A plain, indexed column with no FK to `users`,
   * matching the "no FK on `user_id`" convention used across the schema.
   */
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20, default: FileKind.AVATAR })
  kind: FileKind;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  @Column({ name: 'storage_key', length: 512 })
  storageKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
