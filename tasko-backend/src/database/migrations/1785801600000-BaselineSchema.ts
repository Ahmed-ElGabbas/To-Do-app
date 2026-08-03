import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumnOptions,
  TableForeignKey,
  TableIndex,
  TableIndexOptions,
} from 'typeorm';

/**
 * Baseline schema, mirroring every entity as of 2026-08-03. Written with the
 * driver-agnostic Table API so the same migration runs on Postgres (prod) and
 * sqlite (local verification). Date columns use `timestamp` (native on
 * Postgres, accepted by sqlite); uuid PKs get a `uuid_generate_v4()` default
 * on Postgres and rely on TypeORM's in-app generation on sqlite.
 */
export class BaselineSchema1785801600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const postgres = queryRunner.connection.driver.options.type === 'postgres';

    const uuidPk = (): TableColumnOptions => {
      const column: TableColumnOptions = {
        name: 'id',
        type: 'uuid',
        isPrimary: true,
      };
      if (postgres) {
        column.default = 'uuid_generate_v4()';
      }
      return column;
    };

    const uuid = (name: string): TableColumnOptions => ({
      name,
      type: 'uuid',
      isNullable: false,
    });

    const timestamp = (name: string, nullable = false): TableColumnOptions => ({
      name,
      type: 'timestamp',
      isNullable: nullable,
    });

    const varchar = (name: string, length: number): TableColumnOptions => ({
      name,
      type: 'varchar',
      length: String(length),
      isNullable: false,
    });

    const varcharDefault = (
      name: string,
      length: number,
      value: string,
    ): TableColumnOptions => ({
      name,
      type: 'varchar',
      length: String(length),
      isNullable: false,
      default: `'${value}'`,
    });

    const text = (name: string, nullable = true): TableColumnOptions => ({
      name,
      type: 'text',
      isNullable: nullable,
    });

    const integer = (name: string): TableColumnOptions => ({
      name,
      type: 'integer',
      isNullable: false,
    });

    const boolDefault = (name: string, value: boolean): TableColumnOptions => ({
      name,
      type: 'boolean',
      isNullable: false,
      default: value,
    });

    const createdAt = (): TableColumnOptions => ({
      name: 'created_at',
      type: 'timestamp',
      isNullable: false,
    });

    const updatedAt = (): TableColumnOptions => ({
      name: 'updated_at',
      type: 'timestamp',
      isNullable: false,
    });

    const index = (
      table: string,
      name: string,
      columnNames: string[],
      extra: Partial<TableIndexOptions> = {},
    ): TableIndex => new TableIndex({ name, columnNames, ...extra });
    const create = (
      tableName: string,
      columns: TableColumnOptions[],
    ): Promise<void> =>
      queryRunner.createTable(new Table({ name: tableName, columns }), true);

    const fk = (
      table: string,
      columnNames: string[],
      referencedTable: string,
      onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT',
    ): Promise<void> =>
      queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          columnNames,
          referencedTableName: referencedTable,
          referencedColumnNames: ['id'],
          onDelete,
        }),
      );

    // --- users -------------------------------------------------------------
    await create('users', [
      uuidPk(),
      { ...varchar('email', 255), isUnique: true },
      varchar('password_hash', 255),
      varchar('firstName', 100),
      varchar('lastName', 100),
      varcharDefault('role', 20, 'USER'),
      boolDefault('is_email_verified', false),
      timestamp('email_verified_at', true),
      timestamp('last_login_at', true),
      { name: 'avatar_file_id', type: 'uuid', isNullable: true },
      createdAt(),
      updatedAt(),
    ]);

    // --- teams -------------------------------------------------------------
    await create('teams', [
      uuidPk(),
      uuid('owner_id'),
      varchar('name', 60),
      text('description'),
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'teams',
      index('teams', 'IDX_teams_owner_id', ['owner_id']),
    );

    // --- categories ---------------------------------------------------------
    await create('categories', [
      uuidPk(),
      uuid('user_id'),
      { name: 'team_id', type: 'uuid', isNullable: true },
      varchar('name', 50),
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'categories',
      index('categories', 'IDX_categories_user_id', ['user_id']),
    );
    await queryRunner.createIndex(
      'categories',
      index('categories', 'IDX_categories_team_id', ['team_id']),
    );
    await queryRunner.createIndex(
      'categories',
      index('categories', 'UQ_categories_user_name', ['user_id', 'name'], {
        isUnique: true,
        where: 'team_id IS NULL',
      }),
    );
    await queryRunner.createIndex(
      'categories',
      index('categories', 'UQ_categories_team_name', ['team_id', 'name'], {
        isUnique: true,
        where: 'team_id IS NOT NULL',
      }),
    );
    await fk('categories', ['team_id'], 'teams', 'CASCADE');

    // --- tags ---------------------------------------------------------------
    await create('tags', [
      uuidPk(),
      uuid('user_id'),
      { name: 'team_id', type: 'uuid', isNullable: true },
      varchar('name', 50),
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'tags',
      index('tags', 'IDX_tags_user_id', ['user_id']),
    );
    await queryRunner.createIndex(
      'tags',
      index('tags', 'IDX_tags_team_id', ['team_id']),
    );
    await queryRunner.createIndex(
      'tags',
      index('tags', 'UQ_tags_user_name', ['user_id', 'name'], {
        isUnique: true,
        where: 'team_id IS NULL',
      }),
    );
    await queryRunner.createIndex(
      'tags',
      index('tags', 'UQ_tags_team_name', ['team_id', 'name'], {
        isUnique: true,
        where: 'team_id IS NOT NULL',
      }),
    );
    await fk('tags', ['team_id'], 'teams', 'CASCADE');

    // --- tasks --------------------------------------------------------------
    await create('tasks', [
      uuidPk(),
      uuid('user_id'),
      { name: 'team_id', type: 'uuid', isNullable: true },
      varchar('title', 200),
      varchar('time', 12),
      varchar('date', 10),
      boolDefault('is_done', false),
      timestamp('completed_at', true),
      varcharDefault('priority', 20, 'medium'),
      text('notes'),
      { name: 'category_id', type: 'uuid', isNullable: true },
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'tasks',
      index('tasks', 'IDX_tasks_user_id', ['user_id']),
    );
    await queryRunner.createIndex(
      'tasks',
      index('tasks', 'IDX_tasks_team_id', ['team_id']),
    );
    await fk('tasks', ['team_id'], 'teams', 'CASCADE');
    await fk('tasks', ['category_id'], 'categories', 'SET NULL');

    // --- comments ------------------------------------------------------------
    await create('comments', [
      uuidPk(),
      uuid('task_id'),
      uuid('user_id'),
      text('body', false),
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'comments',
      index('comments', 'IDX_comments_task_id', ['task_id']),
    );
    await fk('comments', ['task_id'], 'tasks', 'CASCADE');

    // --- invitations ----------------------------------------------------------
    await create('invitations', [
      uuidPk(),
      uuid('team_id'),
      varchar('email', 255),
      varchar('token_hash', 64),
      varcharDefault('role', 20, 'VIEWER'),
      varcharDefault('status', 20, 'pending'),
      uuid('invited_by'),
      { ...timestamp('expires_at'), isNullable: false },
      timestamp('accepted_at', true),
      timestamp('declined_at', true),
      { name: 'invited_user_id', type: 'uuid', isNullable: true },
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'invitations',
      index('invitations', 'IDX_invitations_team_id', ['team_id']),
    );
    await queryRunner.createIndex(
      'invitations',
      index('invitations', 'IDX_invitations_email', ['email']),
    );
    await queryRunner.createIndex(
      'invitations',
      index('invitations', 'IDX_invitations_team_id_email', [
        'team_id',
        'email',
      ]),
    );
    await queryRunner.createIndex(
      'invitations',
      index('invitations', 'UQ_invitations_token_hash', ['token_hash'], {
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'invitations',
      index('invitations', 'IDX_invitations_invited_by', ['invited_by']),
    );
    await queryRunner.createIndex(
      'invitations',
      index('invitations', 'IDX_invitations_expires_at', ['expires_at']),
    );
    await fk('invitations', ['team_id'], 'teams', 'CASCADE');

    // --- files ---------------------------------------------------------------
    await create('files', [
      uuidPk(),
      uuid('user_id'),
      varcharDefault('kind', 20, 'avatar'),
      varchar('mime_type', 100),
      integer('size'),
      varchar('original_name', 255),
      varchar('storage_key', 512),
      createdAt(),
    ]);
    await queryRunner.createIndex(
      'files',
      index('files', 'IDX_files_user_id', ['user_id']),
    );
    await fk('files', ['user_id'], 'users', 'CASCADE');

    // --- user_settings ----------------------------------------------------------
    await create('user_settings', [
      uuidPk(),
      uuid('user_id'),
      boolDefault('dark_mode', false),
      boolDefault('notifications_enabled', true),
      varcharDefault('language', 10, 'en'),
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'user_settings',
      index('user_settings', 'UQ_user_settings_user_id', ['user_id'], {
        isUnique: true,
      }),
    );

    // --- refresh_tokens ---------------------------------------------------------
    await create('refresh_tokens', [
      uuidPk(),
      uuid('user_id'),
      varchar('token_hash', 64),
      uuid('family_id'),
      boolDefault('is_revoked', false),
      { ...timestamp('expires_at'), isNullable: false },
      timestamp('revoked_at', true),
      createdAt(),
    ]);
    await queryRunner.createIndex(
      'refresh_tokens',
      index('refresh_tokens', 'IDX_refresh_tokens_user_id', ['user_id']),
    );
    await queryRunner.createIndex(
      'refresh_tokens',
      index('refresh_tokens', 'UQ_refresh_tokens_token_hash', ['token_hash'], {
        isUnique: true,
      }),
    );

    // --- password_reset_tokens ----------------------------------------------------
    await create('password_reset_tokens', [
      uuidPk(),
      uuid('user_id'),
      varchar('token_hash', 64),
      { ...timestamp('expires_at'), isNullable: false },
      timestamp('consumed_at', true),
      createdAt(),
    ]);
    await queryRunner.createIndex(
      'password_reset_tokens',
      index('password_reset_tokens', 'IDX_password_reset_tokens_user_id', [
        'user_id',
      ]),
    );
    await queryRunner.createIndex(
      'password_reset_tokens',
      index(
        'password_reset_tokens',
        'UQ_password_reset_tokens_token_hash',
        ['token_hash'],
        { isUnique: true },
      ),
    );

    // --- email_verification_tokens ---------------------------------------------------
    await create('email_verification_tokens', [
      uuidPk(),
      uuid('user_id'),
      varchar('token_hash', 64),
      { ...timestamp('expires_at'), isNullable: false },
      timestamp('consumed_at', true),
      createdAt(),
    ]);
    await queryRunner.createIndex(
      'email_verification_tokens',
      index(
        'email_verification_tokens',
        'IDX_email_verification_tokens_user_id',
        ['user_id'],
      ),
    );
    await queryRunner.createIndex(
      'email_verification_tokens',
      index(
        'email_verification_tokens',
        'UQ_email_verification_tokens_token_hash',
        ['token_hash'],
        { isUnique: true },
      ),
    );

    // --- activity_logs ---------------------------------------------------------------
    await create('activity_logs', [
      uuidPk(),
      uuid('user_id'),
      uuid('event_id'),
      varchar('type', 32),
      uuid('entity_id'),
      varchar('summary', 255),
      text('metadata'),
      createdAt(),
    ]);
    await queryRunner.createIndex(
      'activity_logs',
      index('activity_logs', 'IDX_activity_logs_user_id', ['user_id']),
    );
    await queryRunner.createIndex(
      'activity_logs',
      index('activity_logs', 'UQ_activity_logs_event_id', ['event_id'], {
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'activity_logs',
      index('activity_logs', 'IDX_activity_logs_type', ['type']),
    );
    await queryRunner.createIndex(
      'activity_logs',
      index('activity_logs', 'IDX_activity_logs_entity_id', ['entity_id']),
    );

    // --- notifications ----------------------------------------------------------------
    await create('notifications', [
      uuidPk(),
      uuid('user_id'),
      uuid('event_id'),
      varchar('type', 32),
      varchar('title', 200),
      varchar('body', 500),
      text('data'),
      boolDefault('is_read', false),
      timestamp('read_at', true),
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'notifications',
      index('notifications', 'IDX_notifications_user_id', ['user_id']),
    );
    await queryRunner.createIndex(
      'notifications',
      index('notifications', 'UQ_notifications_event_id', ['event_id'], {
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'notifications',
      index('notifications', 'IDX_notifications_is_read', ['is_read']),
    );

    // --- user_devices --------------------------------------------------------------------
    await create('user_devices', [
      uuidPk(),
      uuid('user_id'),
      varchar('token', 512),
      { name: 'platform', type: 'varchar', length: '10', isNullable: true },
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'user_devices',
      index('user_devices', 'IDX_user_devices_user_id', ['user_id']),
    );
    await queryRunner.createIndex(
      'user_devices',
      index('user_devices', 'UQ_user_devices_token', ['token'], {
        isUnique: true,
      }),
    );

    // --- team_members -----------------------------------------------------------------------
    await create('team_members', [
      uuidPk(),
      uuid('team_id'),
      uuid('user_id'),
      varcharDefault('role', 20, 'viewer'),
      createdAt(),
      updatedAt(),
    ]);
    await queryRunner.createIndex(
      'team_members',
      index(
        'team_members',
        'UQ_team_members_team_user',
        ['team_id', 'user_id'],
        { isUnique: true },
      ),
    );
    await queryRunner.createIndex(
      'team_members',
      index('team_members', 'IDX_team_members_team_id', ['team_id']),
    );
    await queryRunner.createIndex(
      'team_members',
      index('team_members', 'IDX_team_members_user_id', ['user_id']),
    );
    await fk('team_members', ['team_id'], 'teams', 'CASCADE');

    // --- task_tags (many-to-many join) ----------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'task_tags',
        columns: [
          { name: 'task_id', type: 'uuid', isPrimary: true },
          { name: 'tag_id', type: 'uuid', isPrimary: true },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'task_tags',
      index('task_tags', 'IDX_task_tags_task_id', ['task_id']),
    );
    await queryRunner.createIndex(
      'task_tags',
      index('task_tags', 'IDX_task_tags_tag_id', ['tag_id']),
    );
    await fk('task_tags', ['task_id'], 'tasks', 'CASCADE');
    await fk('task_tags', ['tag_id'], 'tags', 'CASCADE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'task_tags',
      'team_members',
      'user_devices',
      'notifications',
      'activity_logs',
      'email_verification_tokens',
      'password_reset_tokens',
      'refresh_tokens',
      'user_settings',
      'files',
      'invitations',
      'comments',
      'tasks',
      'tags',
      'categories',
      'teams',
      'users',
    ];
    for (const table of tables) {
      await queryRunner.dropTable(table);
    }
  }
}
