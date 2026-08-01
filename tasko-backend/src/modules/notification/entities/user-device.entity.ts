import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DevicePlatform } from '../constants/device-platform.enum';

/** A registered push-delivery device (push token) owned by a user. */
@Entity('user_devices')
export class UserDeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  platform: DevicePlatform | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
