import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds `users.auth_provider` (varchar(20), NOT NULL DEFAULT 'password') — the
 * creation-time marker that records which sign-in method created an account.
 * `password` is the default so the pre-existing rows (and every password
 * signup after this) stay covered without a backfill. Values are constrained
 * by the application enum, not a DB check constraint, matching how `role` is
 * handled in the baseline schema.
 *
 * Driver-agnostic: TableColumn API runs unchanged on Postgres (prod) and
 * sqlite (local verification), mirroring the DatabaseFindingsFixes migration.
 */
export class AuthProviderColumn1786400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'auth_provider',
        type: 'varchar',
        length: '20',
        isNullable: false,
        default: "'password'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'auth_provider');
  }
}
