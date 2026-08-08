import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Role } from '../../common/constants/role.enum';
import { TeamRole } from '../../common/constants/team-role.enum';
import { ActivityLogEntity } from '../../modules/activity-log/entities/activity-log.entity';
import { EmailVerificationTokenEntity } from '../../modules/auth/entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from '../../modules/auth/entities/password-reset-token.entity';
import { RefreshTokenEntity } from '../../modules/auth/entities/refresh-token.entity';
import { CategoryEntity } from '../../modules/category/entities/category.entity';
import { CommentEntity } from '../../modules/comment/entities/comment.entity';
import { FileEntity } from '../../modules/file/entities/file.entity';
import { InvitationStatus } from '../../modules/invitation/constants/invitation-status.enum';
import { InvitationEntity } from '../../modules/invitation/entities/invitation.entity';
import { TeamMemberEntity } from '../../modules/member/entities/team-member.entity';
import { NotificationEntity } from '../../modules/notification/entities/notification.entity';
import { UserDeviceEntity } from '../../modules/notification/entities/user-device.entity';
import { UserSettingsEntity } from '../../modules/settings/entities/user-settings.entity';
import { TagEntity } from '../../modules/tag/entities/tag.entity';
import { TaskEntity } from '../../modules/task/entities/task.entity';
import { TeamEntity } from '../../modules/team/entities/team.entity';
import { UserEntity } from '../../modules/user/entities/user.entity';
import { allEntities } from '../entities';
import { BaselineSchema1785801600000 } from './1785801600000-BaselineSchema';
import { DatabaseFindingsFixes1786147200000 } from './1786147200000-DatabaseFindingsFixes';

const TABLES = [
  'users',
  'teams',
  'team_members',
  'tasks',
  'categories',
  'tags',
  'invitations',
  'comments',
  'files',
  'user_settings',
  'refresh_tokens',
  'password_reset_tokens',
  'email_verification_tokens',
  'activity_logs',
  'notifications',
  'user_devices',
  'task_tags',
];

describe('Database schema migrations', () => {
  let dir: string;
  let dataSource: DataSource;
  let user: UserEntity;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tasko-migrations-'));
    const dbFile = join(dir, 'migrated.sqlite');

    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: dbFile,
      entities: [...allEntities],
      migrations: [
        BaselineSchema1785801600000,
        DatabaseFindingsFixes1786147200000,
      ],
      migrationsRun: true,
      synchronize: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('records every applied migration', async () => {
    const rows = await dataSource.query('SELECT * FROM migrations');
    expect(rows.map((row) => row.name)).toEqual([
      'BaselineSchema1785801600000',
      'DatabaseFindingsFixes1786147200000',
    ]);
  });

  it('creates every table', async () => {
    const rows = await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'",
    );
    const names = rows.map((row) => row.name).sort();
    expect(names).toEqual([...TABLES].sort());
  });

  it('supports insert/select round-trips across the schema', async () => {
    const manager = dataSource.manager;

    user = await manager.save(
      manager.create(UserEntity, {
        email: 'migration@example.com',
        passwordHash: 'hash',
        firstName: 'Mig',
        lastName: 'Ration',
        role: Role.USER,
      }),
    );
    expect(user.id).toBeTruthy();

    const settings = await manager.save(
      manager.create(UserSettingsEntity, { userId: user.id }),
    );
    const device = await manager.save(
      manager.create(UserDeviceEntity, {
        userId: user.id,
        token: 'devicetoken-123',
        platform: 'android',
      }),
    );
    const refresh = await manager.save(
      manager.create(RefreshTokenEntity, {
        userId: user.id,
        tokenHash: 'b'.repeat(64),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );
    const resetToken = await manager.save(
      manager.create(PasswordResetTokenEntity, {
        userId: user.id,
        tokenHash: 'c'.repeat(64),
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );
    const verificationToken = await manager.save(
      manager.create(EmailVerificationTokenEntity, {
        userId: user.id,
        tokenHash: 'd'.repeat(64),
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );
    const file = await manager.save(
      manager.create(FileEntity, {
        userId: user.id,
        mimeType: 'image/png',
        size: 1234,
        originalName: 'me.png',
        storageKey: 'avatars/me.png',
      }),
    );
    const log = await manager.save(
      manager.create(ActivityLogEntity, {
        userId: user.id,
        eventId: randomUUID(),
        type: 'user_signed_up',
        entityId: user.id,
        summary: 'User signed up',
        metadata: { email: 'migration@example.com' },
      }),
    );

    const team = await manager.save(
      manager.create(TeamEntity, { ownerId: user.id, name: 'Migrated Squad' }),
    );
    const membership = await manager.save(
      manager.create(TeamMemberEntity, {
        teamId: team.id,
        userId: user.id,
        role: TeamRole.OWNER,
      }),
    );

    const category = await manager.save(
      manager.create(CategoryEntity, { userId: user.id, name: 'Home' }),
    );
    const tag = await manager.save(
      manager.create(TagEntity, { userId: user.id, name: 'Sprint' }),
    );
    const task = await manager.save(
      manager.create(TaskEntity, {
        userId: user.id,
        teamId: team.id,
        title: 'Write baseline migration',
        time: '09:00 AM',
        date: 'today',
        categoryId: category.id,
      }),
    );

    await manager
      .createQueryBuilder()
      .relation(TaskEntity, 'tags')
      .of(task.id)
      .add(tag.id);

    const comment = await manager.save(
      manager.create(CommentEntity, {
        taskId: task.id,
        userId: user.id,
        body: 'ship it',
      }),
    );
    const invitation = await manager.save(
      manager.create(InvitationEntity, {
        teamId: team.id,
        email: 'invitee@example.com',
        tokenHash: 'a'.repeat(64),
        role: TeamRole.VIEWER,
        status: InvitationStatus.PENDING,
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );
    const notification = await manager.save(
      manager.create(NotificationEntity, {
        userId: user.id,
        eventId: randomUUID(),
        type: 'task_created',
        title: 'Task created',
        body: 'A task was created',
      }),
    );

    for (const entity of [
      settings,
      device,
      refresh,
      resetToken,
      verificationToken,
      file,
      log,
      team,
      membership,
      category,
      tag,
      task,
      comment,
      invitation,
      notification,
    ]) {
      expect(entity.id).toBeTruthy();
    }

    const loaded = await manager.findOne(TaskEntity, {
      where: { id: task.id },
      relations: { tags: true },
    });
    expect(loaded.tags).toHaveLength(1);
    expect(loaded.completedAt).toBeNull();
    expect(loaded.categoryId).toBe(category.id);
  });

  it('cascades team deletion through tasks and members', async () => {
    const manager = dataSource.manager;
    const team = await manager.save(
      manager.create(TeamEntity, { ownerId: user.id, name: 'Cascade Me' }),
    );
    const task = await manager.save(
      manager.create(TaskEntity, {
        userId: user.id,
        teamId: team.id,
        title: 'doomed',
        time: '10:00 AM',
        date: 'tomorrow',
      }),
    );
    await manager.save(
      manager.create(TeamMemberEntity, {
        teamId: team.id,
        userId: user.id,
        role: TeamRole.VIEWER,
      }),
    );

    await manager.delete(TeamEntity, team.id);

    expect(
      await manager.findOne(TaskEntity, { where: { id: task.id } }),
    ).toBeNull();
    expect(
      await manager.count(TeamMemberEntity, { where: { teamId: team.id } }),
    ).toBe(0);
  });
});
