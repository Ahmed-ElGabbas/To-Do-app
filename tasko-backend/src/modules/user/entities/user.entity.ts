import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthProvider } from '../../../common/constants/auth-provider.enum';
import { Role } from '../../../common/constants/role.enum';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  /** Argon2id hash. Never a plaintext password. */
  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  /** DB column `first_name` (snake_case convention); property stays `firstName`. */
  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  /** DB column `last_name` (snake_case convention); property stays `lastName`. */
  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: Role.USER,
  })
  role: Role;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'email_verified_at', type: 'datetime', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  /**
   * ID of the user's avatar file. Managed by the File module; a plain column
   * so the File module never needs to import the User entity cyclically.
   */
  @Column({ name: 'avatar_file_id', type: 'uuid', nullable: true })
  avatarFileId: string | null;

  /** Creation-time marker: password | google | apple | facebook. */
  @Column({
    name: 'auth_provider',
    type: 'varchar',
    length: 20,
    default: AuthProvider.PASSWORD,
  })
  authProvider: AuthProvider;

  /**
   * Confirmed Facebook identity (the Firebase `sub` of the ID token that was
   * verified and then explicitly confirmed against this account). NULL until a
   * Facebook sign-in is confirmed; see Decision 4 in the integration plan.
   */
  @Column({
    name: 'facebook_account_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  facebookAccountId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
