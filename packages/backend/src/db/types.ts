import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export interface UsersTable {
  id: Generated<string>
  github_id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

export interface TeamsTable {
  id: Generated<string>
  slug: string
  name: string | null
  receiver_slack_id: string | null
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

export interface TeamMembersTable {
  team_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: ColumnType<Date, never, never>
}

export interface RefreshTokensTable {
  id: Generated<string>
  user_id: string
  token: string
  revoked: ColumnType<boolean, boolean | undefined, boolean>
  expires_at: Date
  created_at: ColumnType<Date, never, never>
}

export interface SlackInstallsTable {
  id: Generated<string>
  team_id: string
  slack_team_id: string
  bot_token: string
  bot_user_id: string
  installer_slack_id: string | null
  installed_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

export interface HandoffsTable {
  id: Generated<string>
  team_id: string
  author_id: string | null
  status: 'draft' | 'awaiting_review' | 'published'
  filtered_data: unknown
  brief_body: unknown | null
  published_at: Date | null
  slack_ts: string | null
  created_at: ColumnType<Date, never, never>
  updated_at: ColumnType<Date, never, never>
}

export interface HandoffEventsTable {
  id: Generated<string>
  handoff_id: string
  event_type: 'draft_created' | 'brief_generated' | 'brief_failed' | 'published' | 'slack_delivered' | 'slack_failed'
  metadata: unknown | null
  occurred_at: ColumnType<Date, never, never>
}

export interface Database {
  users: UsersTable
  teams: TeamsTable
  team_members: TeamMembersTable
  refresh_tokens: RefreshTokensTable
  slack_installs: SlackInstallsTable
  handoffs: HandoffsTable
  handoff_events: HandoffEventsTable
}

export type User = Selectable<UsersTable>
export type NewUser = Insertable<UsersTable>
export type UpdateUser = Updateable<UsersTable>

export type Team = Selectable<TeamsTable>
export type NewTeam = Insertable<TeamsTable>
export type UpdateTeam = Updateable<TeamsTable>

export type TeamMember = Selectable<TeamMembersTable>
export type NewTeamMember = Insertable<TeamMembersTable>

export type RefreshToken = Selectable<RefreshTokensTable>
export type NewRefreshToken = Insertable<RefreshTokensTable>

export type SlackInstall = Selectable<SlackInstallsTable>
export type NewSlackInstall = Insertable<SlackInstallsTable>

export type Handoff = Selectable<HandoffsTable>
export type NewHandoff = Insertable<HandoffsTable>
export type UpdateHandoff = Updateable<HandoffsTable>

export type HandoffEvent = Selectable<HandoffEventsTable>
export type NewHandoffEvent = Insertable<HandoffEventsTable>
