import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

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
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const db = config.get('database');
        const common = {
          autoLoadEntities: true,
          synchronize: db.synchronize as boolean,
        };
        if (db.type === 'sqlite') {
          return {
            type: 'better-sqlite3',
            database: db.file as string,
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
      },
    }),
  ],
})
export class DatabaseModule {}
