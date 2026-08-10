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

describe('AuthProviderColumn migration', () => {
  let dir: string;
  let dataSource: DataSource;

  const userColumns = async (): Promise<string[]> =>
    (await dataSource.query(`PRAGMA table_info('users')`)).map(
      (row: { name: string }) => row.name,
    );

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tasko-auth-provider-migrations-'));
    const dbFile = join(dir, 'migrated.sqlite');

    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: dbFile,
      entities: [...allEntities],
      migrations: [
        BaselineSchema1785801600000,
        DatabaseFindingsFixes1786147200000,
        AuthProviderColumn1786400000000,
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

  it('applies the migration on top of the baseline + findings', async () => {
    const rows = await dataSource.query('SELECT * FROM migrations');
    expect(rows).toHaveLength(3);
    expect(rows[2].name).toContain('AuthProviderColumn1786400000000');
    expect(await userColumns()).toContain('auth_provider');
  });

  it('defaults existing and new password rows to password', async () => {
    const user = await dataSource.manager.save(
      dataSource.manager.create(UserEntity, {
        email: 'social-column@example.com',
        passwordHash: 'hash',
        firstName: 'Social',
        lastName: 'Column',
        role: Role.USER,
      }),
    );

    expect(user.authProvider).toBe(AuthProvider.PASSWORD);

    const raw = await dataSource.query(
      `SELECT auth_provider FROM users WHERE id = ?`,
      [user.id],
    );
    expect(raw[0].auth_provider).toBe('password');
  });

  it('accepts a social provider value for a social-created user', async () => {
    await dataSource.manager.save(
      dataSource.manager.create(UserEntity, {
        email: 'social-google@example.com',
        passwordHash: 'hash',
        firstName: 'Google',
        lastName: 'User',
        role: Role.USER,
        authProvider: AuthProvider.GOOGLE,
      }),
    );

    const raw = await dataSource.query(
      `SELECT auth_provider FROM users WHERE email = ?`,
      ['social-google@example.com'],
    );
    expect(raw[0].auth_provider).toBe('google');
  });

  it('drops the column in down()', async () => {
    await dataSource.undoLastMigration();

    const columns = await userColumns();
    expect(columns).not.toContain('auth_provider');

    // The baseline columns are untouched by the revert.
    expect(columns).toContain('password_hash');
    expect(columns).toContain('first_name');
  });

  it('re-applies cleanly with up() after a full revert', async () => {
    const migration = new AuthProviderColumn1786400000000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.up(queryRunner);
    await queryRunner.release();

    expect(await userColumns()).toContain('auth_provider');
    const rows = await dataSource.query(`SELECT * FROM migrations`);
    expect(rows).toHaveLength(2);
  });
});
