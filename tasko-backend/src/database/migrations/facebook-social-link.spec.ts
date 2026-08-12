import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { AuthProvider } from '../../common/constants/auth-provider.enum';
import { Role } from '../../common/constants/role.enum';
import { UserEntity } from '../../modules/user/entities/user.entity';
import { allEntities } from '../entities';
import { BaselineSchema1785801600000 } from './1785801600000-BaselineSchema';
import { DatabaseFindingsFixes1786147200000 } from './1786147200000-DatabaseFindingsFixes';
import { AuthProviderColumn1786400000000 } from './1786400000000-AuthProviderColumn';
import { FacebookSocialLink1786492800000 } from './1786492800000-FacebookSocialLink';

describe('FacebookSocialLink migration', () => {
  let dir: string;
  let dataSource: DataSource;

  const userColumns = async (): Promise<string[]> =>
    (await dataSource.query(`PRAGMA table_info('users')`)).map(
      (row: { name: string }) => row.name,
    );

  const tableNames = async (): Promise<string[]> =>
    (
      await dataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'table'`,
      )
    ).map((row: { name: string }) => row.name);

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tasko-facebook-social-link-migrations-'));
    const dbFile = join(dir, 'migrated.sqlite');

    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: dbFile,
      entities: [...allEntities],
      migrations: [
        BaselineSchema1785801600000,
        DatabaseFindingsFixes1786147200000,
        AuthProviderColumn1786400000000,
        FacebookSocialLink1786492800000,
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

  it('adds the facebook_account_id column and the confirm-token table', async () => {
    const rows = await dataSource.query('SELECT * FROM migrations');
    expect(rows).toHaveLength(4);
    expect(rows[3].name).toContain('FacebookSocialLink1786492800000');

    expect(await userColumns()).toContain('facebook_account_id');
    expect(await tableNames()).toContain('social_link_confirm_tokens');
  });

  it('defaults facebook_account_id to NULL for a normal password account', async () => {
    const user = await dataSource.manager.save(
      dataSource.manager.create(UserEntity, {
        email: 'facebook-column@example.com',
        passwordHash: 'hash',
        firstName: 'Facebook',
        lastName: 'Column',
        role: Role.USER,
      }),
    );

    expect(user.facebookAccountId).toBeNull();

    const raw = await dataSource.query(
      `SELECT facebook_account_id FROM users WHERE id = ?`,
      [user.id],
    );
    expect(raw[0].facebook_account_id).toBeNull();
  });

  it('persists a confirmed facebook_account_id', async () => {
    await dataSource.manager.save(
      dataSource.manager.create(UserEntity, {
        email: 'facebook-linked@example.com',
        passwordHash: 'hash',
        firstName: 'Facebook',
        lastName: 'Linked',
        role: Role.USER,
        authProvider: AuthProvider.PASSWORD,
        facebookAccountId: 'firebase-sub-123',
      }),
    );

    const raw = await dataSource.query(
      `SELECT facebook_account_id FROM users WHERE email = ?`,
      ['facebook-linked@example.com'],
    );
    expect(raw[0].facebook_account_id).toBe('firebase-sub-123');
  });

  it('drops both additions in down() and re-applies cleanly with up()', async () => {
    await dataSource.undoLastMigration();

    const columns = await userColumns();
    expect(columns).not.toContain('facebook_account_id');
    expect(await tableNames()).not.toContain('social_link_confirm_tokens');
    expect(columns).toContain('auth_provider');

    const migration = new FacebookSocialLink1786492800000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.up(queryRunner);
    await queryRunner.release();

    expect(await userColumns()).toContain('facebook_account_id');
    expect(await tableNames()).toContain('social_link_confirm_tokens');
  });
});
