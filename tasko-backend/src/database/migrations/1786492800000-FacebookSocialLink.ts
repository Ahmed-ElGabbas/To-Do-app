import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

/**
 * Facebook account linking (Round 1c, Decision 4):
 *
 * 1. `users.facebook_account_id` — nullable varchar(255) holding the confirmed
 *    Facebook identity (the Firebase `sub` of the ID token that was verified
 *    and then explicitly confirmed against the existing account). NULL means
 *    no Facebook identity has been linked yet. This keeps the single-column
 *    auth model: `auth_provider` still records only the original signup
 *    method, and there is no multi-provider linking table.
 *
 * 2. `social_link_confirm_tokens` — one-time tokens emailed to an existing
 *    account (passwordless accounts only) to confirm that a Facebook sign-in
 *    that matched the account's email really belongs to the account owner.
 *    Mirrors `password_reset_tokens` and additionally binds the provider and
 *    the pending provider account id so the link can be persisted when the
 *    emailed link is clicked.
 *
 * Driver-agnostic: Table API runs unchanged on Postgres (prod) and sqlite
 * (local verification), mirroring the BaselineSchema/AuthProviderColumn
 * migrations.
 */
export class FacebookSocialLink1786492800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const postgres = queryRunner.connection.driver.options.type === 'postgres';

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'facebook_account_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'social_link_confirm_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            ...(postgres ? { default: 'uuid_generate_v4()' } : {}),
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          {
            name: 'token_hash',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'provider_account_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          { name: 'expires_at', type: 'timestamp', isNullable: false },
          { name: 'consumed_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'social_link_confirm_tokens',
      new TableIndex({
        name: 'IDX_social_link_confirm_tokens_user_id',
        columnNames: ['user_id'],
      }),
    );
    await queryRunner.createIndex(
      'social_link_confirm_tokens',
      new TableIndex({
        name: 'UQ_social_link_confirm_tokens_token_hash',
        columnNames: ['token_hash'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('social_link_confirm_tokens');
    await queryRunner.dropColumn('users', 'facebook_account_id');
  }
}
