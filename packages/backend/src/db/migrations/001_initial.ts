import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {

  await db.schema
    .createTable('users')
    .addColumn('id',           'uuid',        col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('github_id',    'text',        col => col.unique().notNull())
    .addColumn('email',        'text')
    .addColumn('display_name', 'text')
    .addColumn('avatar_url',   'text')
    .addColumn('created_at',   'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at',   'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .execute()

  await db.schema
    .createTable('teams')
    .addColumn('id',                'uuid',        col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('slug',              'text',        col => col.unique().notNull())
    .addColumn('name',              'text')
    .addColumn('receiver_slack_id', 'text')
    .addColumn('created_at',        'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at',        'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .execute()

  await db.schema
    .createTable('team_members')
    .addColumn('team_id',   'uuid', col => col.notNull().references('teams.id').onDelete('cascade'))
    .addColumn('user_id',   'uuid', col => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('role',      'text', col => col.notNull().defaultTo('member'))
    .addCheckConstraint('team_members_role_check', sql`role IN ('admin', 'member')`)
    .addColumn('joined_at', 'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .addPrimaryKeyConstraint('team_members_pk', ['team_id', 'user_id'])
    .execute()

  await db.schema
    .createTable('refresh_tokens')
    .addColumn('id',         'uuid',        col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id',    'uuid',        col => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('token',      'text',        col => col.unique().notNull())
    .addColumn('revoked',    'boolean',     col => col.notNull().defaultTo(false))
    .addColumn('expires_at', 'timestamptz', col => col.notNull())
    .addColumn('created_at', 'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .execute()

  await db.schema
    .createTable('slack_installs')
    .addColumn('id',                 'uuid',        col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('team_id',            'uuid',        col => col.notNull().references('teams.id').onDelete('cascade'))
    .addColumn('slack_team_id',      'text',        col => col.unique().notNull())
    .addColumn('bot_token',          'text',        col => col.notNull())
    .addColumn('bot_user_id',        'text',        col => col.notNull())
    .addColumn('installer_slack_id', 'text')
    .addColumn('installed_at',       'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at',         'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .execute()

  await db.schema
    .createTable('handoffs')
    .addColumn('id',            'uuid',        col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('team_id',       'uuid',        col => col.notNull().references('teams.id').onDelete('cascade'))
    .addColumn('author_id',     'uuid',        col => col.references('users.id'))
    .addColumn('status',        'text',        col => col.notNull().defaultTo('draft'))
    .addColumn('filtered_data', sql`jsonb`,    col => col.notNull())
    .addColumn('brief_body',    sql`jsonb`)
    .addColumn('published_at',  'timestamptz')
    .addColumn('slack_ts',      'text')
    .addColumn('created_at',    'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at',    'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .addCheckConstraint('handoffs_status_check', sql`status IN ('draft', 'awaiting_review', 'published')`)
    .execute()

  await sql`
    ALTER TABLE handoffs
    ADD CONSTRAINT handoffs_author_team_fk
    FOREIGN KEY (team_id, author_id)
    REFERENCES team_members(team_id, user_id)
    ON DELETE SET NULL
  `.execute(db)

  await db.schema
    .createTable('handoff_events')
    .addColumn('id',          'uuid',        col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('handoff_id',  'uuid',        col => col.notNull().references('handoffs.id').onDelete('cascade'))
    .addColumn('event_type',  'text',        col => col.notNull())
    .addColumn('metadata',    sql`jsonb`)
    .addColumn('occurred_at', 'timestamptz', col => col.defaultTo(sql`now()`).notNull())
    .addCheckConstraint(
      'handoff_events_type_check',
      sql`event_type IN ('draft_created', 'brief_generated', 'brief_failed', 'published', 'slack_delivered', 'slack_failed')`
    )
    .execute()

  await db.schema.createIndex('idx_handoffs_team').on('handoffs').columns(['team_id', 'status', 'created_at']).execute()
  await db.schema.createIndex('idx_handoffs_author').on('handoffs').columns(['author_id', 'created_at']).execute()
  await db.schema.createIndex('idx_refresh_tokens_token').on('refresh_tokens').column('token').execute()
  await sql`CREATE INDEX idx_refresh_tokens_active ON refresh_tokens (user_id, expires_at) WHERE revoked = false`.execute(db)
  await db.schema.createIndex('idx_slack_installs_team').on('slack_installs').column('team_id').execute()
  await db.schema.createIndex('idx_handoff_events_handoff').on('handoff_events').columns(['handoff_id', 'occurred_at']).execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('handoff_events').ifExists().execute()
  await db.schema.dropTable('handoffs').ifExists().execute()
  await db.schema.dropTable('slack_installs').ifExists().execute()
  await db.schema.dropTable('refresh_tokens').ifExists().execute()
  await db.schema.dropTable('team_members').ifExists().execute()
  await db.schema.dropTable('teams').ifExists().execute()
  await db.schema.dropTable('users').ifExists().execute()
}
