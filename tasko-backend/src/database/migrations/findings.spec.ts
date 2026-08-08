import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Role } from '../../common/constants/role.enum';
import { TeamRole } from '../../common/constants/team-role.enum';
import { InvitationStatus } from '../../modules/invitation/constants/invitation-status.enum';
import { InvitationEntity } from '../../modules/invitation/entities/invitation.entity';
import { TeamEntity } from '../../modules/team/entities/team.entity';
import { UserEntity } from '../../modules/user/entities/user.entity';
import { allEntities } from '../entities';
import { BaselineSchema1785801600000 } from './1785801600000-BaselineSchema';
import { DatabaseFindingsFixes1786147200000 } from './1786147200000-DatabaseFindingsFixes';

describe('DatabaseFindingsFixes migration', () => {
  let dir: string;
  let dataSource: DataSource;
  let user: UserEntity;
  let team: TeamEntity;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tasko-findings-migrations-'));
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

  const indexNames = async (table: string): Promise<string[]> => {
    const rows = await dataSource.query(`PRAGMA index_list('${table}')`);
    return rows.map((row: { name: string }) => row.name);
  };

  const foreignKeys = async (
    table: string,
  ): Promise<Array<{ table: string }>> =>
    dataSource.query(`PRAGMA foreign_key_list('${table}')`);

  it('applies both migrations', async () => {
    const rows = await dataSource.query('SELECT * FROM migrations');
    expect(rows).toHaveLength(2);
    expect(rows[1].name).toContain('DatabaseFindingsFixes1786147200000');
  });

  it('drops the files.user_id FK while keeping the column and its index', async () => {
    const fks = await foreignKeys('files');
    expect(fks.some((fk) => fk.table === 'users')).toBe(false);
    expect(
      (await indexNames('files')).some((n) => n.includes('files_user')),
    ).toBe(true);
  });

  it('adds an index on refresh_tokens.family_id', async () => {
    expect(await indexNames('refresh_tokens')).toContain(
      'IDX_refresh_tokens_family_id',
    );
  });

  it('renames users.firstName/lastName to first_name/last_name', async () => {
    const rows = await dataSource.query(`PRAGMA table_info('users')`);
    const names = rows.map((row) => row.name);
    expect(names).toContain('first_name');
    expect(names).toContain('last_name');
    expect(names).not.toContain('firstName');
    expect(names).not.toContain('lastName');
  });

  it('adds a partial unique index preventing duplicate pending invites', async () => {
    user = await dataSource.manager.save(
      dataSource.manager.create(UserEntity, {
        email: 'findings@example.com',
        passwordHash: 'hash',
        firstName: 'Fin',
        lastName: 'Dings',
        role: Role.USER,
      }),
    );
    team = await dataSource.manager.save(
      dataSource.manager.create(TeamEntity, {
        ownerId: user.id,
        name: 'Findings Squad',
      }),
    );

    const base = {
      teamId: team.id,
      email: 'duplicate@example.com',
      tokenHash: '1'.repeat(64),
      role: TeamRole.VIEWER,
      status: InvitationStatus.PENDING,
      invitedBy: user.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    };

    await dataSource.manager.save(
      dataSource.manager.create(InvitationEntity, { ...base }),
    );

    // A second PENDING invite for the same team+email must be rejected.
    await expect(
      dataSource.manager.save(
        dataSource.manager.create(InvitationEntity, {
          ...base,
          tokenHash: '2'.repeat(64),
        }),
      ),
    ).rejects.toThrow();

    // A resolved (non-pending) invite for the same team+email is allowed.
    await expect(
      dataSource.manager.save(
        dataSource.manager.create(InvitationEntity, {
          ...base,
          tokenHash: '3'.repeat(64),
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          invitedUserId: user.id,
        }),
      ),
    ).resolves.toBeDefined();
  });

  it('reverts everything in down()', async () => {
    await dataSource.undoLastMigration();

    expect(
      (await indexNames('invitations')).some((n) =>
        n.includes('team_email_pending'),
      ),
    ).toBe(false);
    expect(
      (await indexNames('refresh_tokens')).some((n) => n.includes('family_id')),
    ).toBe(false);

    const rows = await dataSource.query(`PRAGMA table_info('users')`);
    const names = rows.map((row) => row.name);
    expect(names).toContain('firstName');
    expect(names).toContain('lastName');
    expect(names).not.toContain('first_name');
    expect(names).not.toContain('last_name');

    const fks = await foreignKeys('files');
    expect(fks.some((fk) => fk.table === 'users')).toBe(true);
  });

  it('re-applies cleanly with up() after a full revert', async () => {
    const findings = new DatabaseFindingsFixes1786147200000();
    const queryRunner = dataSource.createQueryRunner();
    await findings.up(queryRunner);
    await queryRunner.release();

    const fks = await foreignKeys('files');
    expect(fks.some((fk) => fk.table === 'users')).toBe(false);
    expect(await indexNames('refresh_tokens')).toContain(
      'IDX_refresh_tokens_family_id',
    );
    const rows = await dataSource.query(`PRAGMA table_info('users')`);
    expect(rows.map((row) => row.name)).toContain('first_name');
  });
});
