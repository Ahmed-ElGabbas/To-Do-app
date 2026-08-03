import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { allEntities } from './entities';

/**
 * Standalone TypeORM DataSource for the migration CLI (`npm run migration:*`).
 * Reads the same env vars as the app: DB_TYPE defaults to sqlite so migrations
 * can be run locally without Postgres; point it at Postgres in production
 * (DB_TYPE=postgres DB_HOST=... DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=...).
 */
function buildOptions(): DataSourceOptions {
  const type = (process.env.DB_TYPE ?? 'sqlite') as 'postgres' | 'sqlite';

  if (type === 'sqlite') {
    return {
      type: 'better-sqlite3',
      database: process.env.DB_FILE ?? 'tasko.sqlite',
      entities: [...allEntities],
      // Only timestamped migration files; specs live beside them but must not
      // be loaded by the CLI (TypeORM 1.x globs each pattern independently).
      // Matches .ts in src (dev, ts-node) and .js in dist (prod, compiled).
      migrations: [__dirname + '/migrations/[0-9]*.{ts,js}'],
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'tasko',
    password: process.env.DB_PASSWORD ?? 'tasko',
    database: process.env.DB_DATABASE ?? 'tasko',
    entities: [...allEntities],
    migrations: [__dirname + '/migrations/[0-9]*.{ts,js}'],
  };
}

export default new DataSource(buildOptions());
