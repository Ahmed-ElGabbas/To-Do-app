import { DatabaseConfig, buildTypeOrmOptions } from './database.module';

describe('buildTypeOrmOptions', () => {
  const postgres = (synchronize?: boolean): DatabaseConfig => ({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'tasko',
    password: 'tasko',
    database: 'tasko',
    synchronize,
  });

  const sqlite = (synchronize?: boolean): DatabaseConfig => ({
    type: 'sqlite',
    file: ':memory:',
    synchronize,
  });

  it('hard-fails when Postgres would auto-sync (ADR-0004)', () => {
    expect(() => buildTypeOrmOptions(postgres(true))).toThrow(
      /synchronize.*not allowed for Postgres/i,
    );
  });

  it('never enables synchronize for Postgres even when unset', () => {
    expect(buildTypeOrmOptions(postgres())).toMatchObject({
      type: 'postgres',
      synchronize: false,
    });
    expect(buildTypeOrmOptions(postgres(false))).toMatchObject({
      type: 'postgres',
      synchronize: false,
    });
  });

  it('allows synchronize only for the sqlite tier', () => {
    expect(buildTypeOrmOptions(sqlite(true))).toMatchObject({
      type: 'better-sqlite3',
      synchronize: true,
      database: ':memory:',
    });
    expect(buildTypeOrmOptions(sqlite())).toMatchObject({
      type: 'better-sqlite3',
      synchronize: false,
    });
  });

  it('keeps autoLoadEntities on for every tier', () => {
    expect(buildTypeOrmOptions(postgres(false))).toMatchObject({
      autoLoadEntities: true,
    });
    expect(buildTypeOrmOptions(sqlite(true))).toMatchObject({
      autoLoadEntities: true,
    });
  });
});
