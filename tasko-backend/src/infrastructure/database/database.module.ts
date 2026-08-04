import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

/** Validated `database` block from `src/config/configuration.ts`. */
export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  file?: string;
  synchronize?: boolean;
}

/**
 * Maps validated database configuration to TypeORM options. `synchronize` may
 * only ever be true for the sqlite tier (dev/test); enabling it for Postgres is
 * a hard startup failure because production schema changes must go through the
 * migration pipeline (see ADR-0004). Extracted as a pure function so the
 * guarantee is directly unit-tested.
 */
export function buildTypeOrmOptions(db: DatabaseConfig): TypeOrmModuleOptions {
  if (db.synchronize === true && db.type !== 'sqlite') {
    throw new Error(
      'DB_SYNCHRONIZE=true is not allowed for Postgres (ADR-0004): ' +
        'production schema changes must go through migrations.',
    );
  }

  const common = {
    autoLoadEntities: true,
    synchronize: db.synchronize === true,
  };

  if (db.type === 'sqlite') {
    return {
      type: 'better-sqlite3',
      database: db.file ?? 'tasko.sqlite',
      ...common,
    };
  }

  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    ...common,
  };
}

/**
 * Registers the TypeORM connection from validated configuration. Uses
 * better-sqlite3 (in-memory in tests) or Postgres depending on DB_TYPE.
 * `synchronize` defaults to true for sqlite tiers (dev/test) and false for
 * Postgres; production schema changes must go through the migration pipeline
 * in src/database/migrations (see ADR-0004).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions =>
        buildTypeOrmOptions(
          config.get<DatabaseConfig>('database') ?? { type: 'sqlite' },
        ),
    }),
  ],
})
export class DatabaseModule {}
