import { ActivityLogEntity } from '../modules/activity-log/entities/activity-log.entity';
import { EmailVerificationTokenEntity } from '../modules/auth/entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from '../modules/auth/entities/password-reset-token.entity';
import { RefreshTokenEntity } from '../modules/auth/entities/refresh-token.entity';
import { CategoryEntity } from '../modules/category/entities/category.entity';
import { CommentEntity } from '../modules/comment/entities/comment.entity';
import { FileEntity } from '../modules/file/entities/file.entity';
import { InvitationEntity } from '../modules/invitation/entities/invitation.entity';
import { TeamMemberEntity } from '../modules/member/entities/team-member.entity';
import { NotificationEntity } from '../modules/notification/entities/notification.entity';
import { UserDeviceEntity } from '../modules/notification/entities/user-device.entity';
import { UserSettingsEntity } from '../modules/settings/entities/user-settings.entity';
import { TagEntity } from '../modules/tag/entities/tag.entity';
import { TaskEntity } from '../modules/task/entities/task.entity';
import { TeamEntity } from '../modules/team/entities/team.entity';
import { UserEntity } from '../modules/user/entities/user.entity';

/**
 * Every entity in the application, listed explicitly for the CLI data source
 * (typeorm commands are standalone and cannot rely on Nest's
 * `autoLoadEntities`). The app itself keeps using autoLoadEntities at runtime.
 */
export const allEntities = [
  UserEntity,
  TeamEntity,
  TeamMemberEntity,
  TaskEntity,
  CategoryEntity,
  TagEntity,
  InvitationEntity,
  CommentEntity,
  FileEntity,
  UserSettingsEntity,
  RefreshTokenEntity,
  PasswordResetTokenEntity,
  EmailVerificationTokenEntity,
  ActivityLogEntity,
  NotificationEntity,
  UserDeviceEntity,
] as const;
