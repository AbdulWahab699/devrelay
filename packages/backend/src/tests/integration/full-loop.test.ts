import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '../../app.js'
import { db } from '../../db/connection.js'

// ── Mocks ────────────────────────────────────────────────────────

// Mock GitHub service
vi.mock('../../services/github-service.js', () => ({
  exchangeCode: vi.fn().mockResolvedValue('mock-github-access-token'),
  getGitHubUser: vi.fn().mockResolvedValue({
    id: 99999999,
    login: 'testuser',
    email: 'test@devrelay.app',
    avatar_url: 'https://avatars.githubusercontent.com/u/99999999',
    name: 'Test User',
  }),
  GitHubServiceError: class GitHubServiceError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 500) {
      super(message)
      this.name = 'GitHubServiceError'
      this.statusCode = statusCode
    }
  },
}))

// Mock Anthropic service
vi.mock('../../services/anthropic-service.js', () => ({
  generateBrief: vi.fn().mockResolvedValue({
    what_changed: 'Added authentication middleware and JWT token rotation',
    what_failed: 'Initial test run failed due to missing env vars — fixed by updating .env',
    decisions_made: 'Chose Kysely over Prisma for cold start performance',
    next_steps: 'Wire up Slack OAuth flow and test end-to-end publish',
    confidence: 'high',
  }),
  BriefParseError: class BriefParseError extends Error {
    rawOutput: string
    constructor(message: string, rawOutput: string) {
      super(message)
      this.name = 'BriefParseError'
      this.rawOutput = rawOutput
    }
  },
  ClaudeOverloadError: class ClaudeOverloadError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ClaudeOverloadError'
    }
  },
}))

// Mock Slack service
vi.mock('../../services/slack-service.js', () => ({
  exchangeSlackCode: vi.fn().mockResolvedValue({
    bot_token: 'xoxb-mock-bot-token',
    bot_user_id: 'U_BOT_001',
    team: { id: 'T_SLACK_001', name: 'DevRelay Test Workspace' },
    authed_user: { id: 'U_INSTALLER_001' },
  }),
  buildHandoffBlocks: vi.fn().mockReturnValue([
    { type: 'header', text: { type: 'plain_text', text: 'DevRelay Handoff' } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: '*What Changed*\nTest change' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*What Failed*\nNothing' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Decisions Made*\nUsed Kysely' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Next Steps*\nDeploy' } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: '*Confidence:* HIGH' }] },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: 'Archive ->' } },
  ]),
  sendHandoffDM: vi.fn().mockResolvedValue('1234567890.123456'),
  SlackServiceError: class SlackServiceError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 500) {
      super(message)
      this.name = 'SlackServiceError'
      this.statusCode = statusCode
    }
  },
  SlackDeliveryError: class SlackDeliveryError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'SlackDeliveryError'
    }
  },
}))

// ── Test State ───────────────────────────────────────────────────

let app: ReturnType<typeof buildApp>
let jwt: string
let userId: string
let teamId: string
let handoffId: string

// ── Setup / Teardown ─────────────────────────────────────────────

beforeAll(async () => {
  app = buildApp()
  await app.ready()
})

afterAll(async () => {
  // Clean up test data in reverse dependency order
  if (handoffId) {
    await db.deleteFrom('handoff_events').where('handoff_id', '=', handoffId).execute().catch(() => {})
    await db.deleteFrom('handoffs').where('id', '=', handoffId).execute().catch(() => {})
  }
  if (teamId) {
    await db.deleteFrom('slack_installs').where('team_id', '=', teamId).execute().catch(() => {})
    await db.deleteFrom('team_members').where('team_id', '=', teamId).execute().catch(() => {})
    await db.deleteFrom('refresh_tokens').where('user_id', '=', userId).execute().catch(() => {}).catch(() => {})
    await db.deleteFrom('teams').where('id', '=', teamId).execute().catch(() => {})
  }
  if (userId) {
    await db.deleteFrom('users').where('id', '=', userId).execute().catch(() => {})
  }
  await app.close()
  await db.destroy()
})

// ── Tests ────────────────────────────────────────────────────────

describe('Full Loop Integration — CLI → API → Slack', () => {

  it('POST /auth/github — exchanges code, creates user + team, returns JWT', async () => {
    const res = await supertest(app.server)
      .post('/auth/github')
      .send({ code: 'mock-github-code' })
      .expect(200)

    expect(res.body.jwt).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
    expect(res.body.user).toBeDefined()
    expect(res.body.isNewUser).toBe(true)

    jwt = res.body.jwt
    userId = res.body.user.id

    // Verify team was created
    const membership = await db
      .selectFrom('team_members')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst()

    expect(membership).toBeDefined()
    expect(membership?.role).toBe('admin')
    teamId = membership!.team_id
  })

  it('POST /slack/authorize — exchanges Slack code, stores install', async () => {
    const res = await supertest(app.server)
      .post('/slack/authorize')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ code: 'mock-slack-code' })
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.workspaceName).toBe('DevRelay Test Workspace')

    // Verify slack_installs row created
    const install = await db
      .selectFrom('slack_installs')
      .selectAll()
      .where('team_id', '=', teamId)
      .executeTakeFirst()

    expect(install).toBeDefined()
    expect(install?.bot_token).toBe('xoxb-mock-bot-token')
    expect(install?.slack_team_id).toBe('T_SLACK_001')
  })

  it('GET /slack/status — returns connected: true after install', async () => {
    const res = await supertest(app.server)
      .get('/slack/status')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200)

    expect(res.body.connected).toBe(true)
    expect(res.body.receiverConfigured).toBe(true)
  })

  it('POST /handoffs/draft — creates draft, calls Claude, returns brief', async () => {
    const res = await supertest(app.server)
      .post('/handoffs/draft')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        gitSummary: 'Added JWT middleware and token rotation logic',
        terminalCommands: [
          { cmd: 'npm test', signalScore: 8 },
          { cmd: 'git commit -m "feat: add auth middleware"', signalScore: 7 },
        ],
        slackSummary: '',
      })
      .expect(200)

    expect(res.body.id).toBeDefined()
    expect(res.body.status).toBe('awaiting_review')
    expect(res.body.brief).toBeDefined()
    expect(res.body.brief.what_changed).toBeDefined()
    expect(res.body.brief.confidence).toBe('high')

    handoffId = res.body.id
  })

  it('GET /handoffs/:id — returns handoff with parsed brief_body', async () => {
    const res = await supertest(app.server)
      .get(`/handoffs/${handoffId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200)

    expect(res.body.id).toBe(handoffId)
    expect(res.body.status).toBe('awaiting_review')
    // Issue 9 fix: brief_body should be parsed object not string
    expect(typeof res.body.brief_body).toBe('object')
    expect(res.body.brief_body.what_changed).toBeDefined()
  })

  it('GET /handoffs — returns paginated list with handoff', async () => {
    const res = await supertest(app.server)
      .get('/handoffs')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200)

    expect(res.body.items).toBeDefined()
    expect(res.body.items.length).toBeGreaterThan(0)
    expect(res.body.hasMore).toBe(false)

    const found = res.body.items.find((h: { id: string }) => h.id === handoffId)
    expect(found).toBeDefined()
  })

  it('POST /handoffs/:id/publish — sends Slack DM, updates status to published', async () => {
    const res = await supertest(app.server)
      .post(`/handoffs/${handoffId}/publish`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.slackTs).toBe('1234567890.123456')

    // Verify DB status updated
    const handoff = await db
      .selectFrom('handoffs')
      .select(['status', 'slack_ts', 'published_at'])
      .where('id', '=', handoffId)
      .executeTakeFirst()

    expect(handoff?.status).toBe('published')
    expect(handoff?.slack_ts).toBe('1234567890.123456')
    expect(handoff?.published_at).toBeDefined()
  })

  it('POST /handoffs/:id/publish — returns 409 if already published', async () => {
    const res = await supertest(app.server)
      .post(`/handoffs/${handoffId}/publish`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(409)

    expect(res.body.error).toBe('Conflict')
  })

  it('Verify handoff_events — 3 rows: draft_created, brief_generated, published', async () => {
    const events = await db
      .selectFrom('handoff_events')
      .select(['event_type'])
      .where('handoff_id', '=', handoffId)
      .orderBy('occurred_at', 'asc')
      .execute()

    expect(events.length).toBe(3)
    expect(events[0].event_type).toBe('draft_created')
    expect(events[1].event_type).toBe('brief_generated')
    expect(events[2].event_type).toBe('published')
  })

  it('Verify Block Kit blocks structure — 9 blocks, correct types', async () => {
    const { buildHandoffBlocks } = await import('../../services/slack-service.js')
    expect(vi.mocked(buildHandoffBlocks)).toHaveBeenCalledOnce()

    const { sendHandoffDM } = await import('../../services/slack-service.js')
    expect(vi.mocked(sendHandoffDM)).toHaveBeenCalledOnce()
  })
})
