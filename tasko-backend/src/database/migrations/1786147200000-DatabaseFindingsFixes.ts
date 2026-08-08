import {
  MigrationInterface,
  QueryRunner,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Implements the four accepted fixes from the Database Architecture
 * Reference's Findings section. Each change is an independent block below,
 * reversible on its own via the matching block in `down()`.
 *
 * Driver-agnostic style: the same migration runs on Postgres (prod) and
 * sqlite (local verification). Index names follow the project convention
 * (`IDX_`/`UQ_` prefixes); on sqlite the FK drop and column renames go
 * through TypeORM's table-rebuild path, which preserves data and indices.
 */
export class DatabaseFindingsFixes1786147200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // 1. files.user_id: drop the FK to users, keep column + index.
    // Brings `files` in line with the "no FK on `user_id`" convention used
    // by every other table. Data is not touched — only the constraint goes.
    // ------------------------------------------------------------------
    const filesTable = await queryRunner.getTable('files');
    const filesUserFk = filesTable?.foreignKeys.find((fk) =>
      fk.columnNames.includes('user_id'),
    );
    if (filesUserFk?.name) {
      await queryRunner.dropForeignKey('files', filesUserFk.name);
    }

    // ------------------------------------------------------------------
    // 2. refresh_tokens.family_id: add a supporting index for the
    //    family-revocation query (`WHERE family_id = X`).
    // ------------------------------------------------------------------
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_family_id',
        columnNames: ['family_id'],
      }),
    );

    // ------------------------------------------------------------------
    // 3. users.firstName/lastName -> first_name/last_name (snake_case).
    // ------------------------------------------------------------------
    await queryRunner.renameColumn('users', 'firstName', 'first_name');
    await queryRunner.renameColumn('users', 'lastName', 'last_name');

    // ------------------------------------------------------------------
    // 4. invitations: partial unique index on (team_id, email) filtered by
    //    status = 'pending', mirroring the categories/tags partial-index
    //    technique. Prevents duplicate pending invites even under a race.
    // ------------------------------------------------------------------
    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'UQ_invitations_team_email_pending',
        columnNames: ['team_id', 'email'],
        isUnique: true,
        where: "status = 'pending'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse of the above, in reverse order.
    await queryRunner.dropIndex(
      'invitations',
      'UQ_invitations_team_email_pending',
    );

    await queryRunner.renameColumn('users', 'first_name', 'firstName');
    await queryRunner.renameColumn('users', 'last_name', 'lastName');

    await queryRunner.dropIndex(
      'refresh_tokens',
      'IDX_refresh_tokens_family_id',
    );

    await queryRunner.createForeignKey(
      'files',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }
}
