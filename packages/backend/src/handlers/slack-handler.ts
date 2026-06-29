import type { FastifyRequest, FastifyReply } from 'fastify'
import { exchangeSlackCode, SlackServiceError } from '../services/slack-service.js'
import { db } from '../db/connection.js'

interface JWTPayload {
  userId: string
  teamId: string
  displayName: string
}

interface SlackAuthorizeBody {
  code: string
}

export async function handleSlackAuthorize(
  request: FastifyRequest<{ Body: SlackAuthorizeBody }>,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload
  const { code } = request.body

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Slack OAuth code is required',
    })
  }

  try {
    const slackResult = await exchangeSlackCode(code)

    // Issue 1: atomic upsert — eliminates TOCTOU race condition between
    // SELECT + INSERT that could cause duplicate key errors under concurrent requests
    // Issue 2: SECURITY TODO — bot_token stored in plaintext.
    // Encrypt with AES-256-GCM before v1.1 release.
    await db
      .insertInto('slack_installs')
      .values({
        team_id: payload.teamId,
        slack_team_id: slackResult.team.id,
        bot_token: slackResult.bot_token, // plaintext MVP — encrypt in v1.1
        bot_user_id: slackResult.bot_user_id,
        installer_slack_id: slackResult.authed_user.id,
      })
      .onConflict(oc =>
        oc.column('slack_team_id').doUpdateSet({
          bot_token: slackResult.bot_token,
          bot_user_id: slackResult.bot_user_id,
          installer_slack_id: slackResult.authed_user.id,
        })
      )
      .execute()

    // Set receiver_slack_id on team if not already configured
    const team = await db
      .selectFrom('teams')
      .select(['receiver_slack_id'])
      .where('id', '=', payload.teamId)
      .executeTakeFirst()

    if (!team?.receiver_slack_id && slackResult.authed_user.id) {
      await db
        .updateTable('teams')
        .set({ receiver_slack_id: slackResult.authed_user.id })
        .where('id', '=', payload.teamId)
        .execute()
    }

    return reply.status(200).send({
      success: true,
      workspaceName: slackResult.team.name,
    })
  } catch (err) {
    if (err instanceof SlackServiceError) {
      return reply.status(err.statusCode).send({
        error: 'Slack Auth Failed',
        message: err.message,
      })
    }

    request.log.error(err, '[handleSlackAuthorize] Unexpected error during Slack OAuth')
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Slack authorization failed. Please try again.',
    })
  }
}

export async function handleSlackStatus(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload

  try {
    // Issue 8: parallel DB queries — single round trip instead of two sequential
    const [install, team] = await Promise.all([
      db
        .selectFrom('slack_installs')
        .select(['id', 'slack_team_id', 'bot_user_id', 'installed_at'])
        .where('team_id', '=', payload.teamId)
        .executeTakeFirst(),
      db
        .selectFrom('teams')
        .select(['receiver_slack_id'])
        .where('id', '=', payload.teamId)
        .executeTakeFirst(),
    ])

    return reply.status(200).send({
      connected: !!install,
      slackTeamId: install?.slack_team_id ?? null,
      receiverConfigured: !!team?.receiver_slack_id,
    })
  } catch (err) {
    request.log.error(err, '[handleSlackStatus] Unexpected error fetching Slack status')
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to fetch Slack status.',
    })
  }
}


export async function handleSlackCallback(
  request: FastifyRequest<{ Querystring: { code?: string; error?: string } }>,
  reply: FastifyReply
) {
  const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const { code, error } = request.query

  if (error || !code) {
    return reply.redirect(`${FRONTEND_URL}/settings?slack_error=${error ?? 'missing_code'}`)
  }

  try {
    const slackResult = await exchangeSlackCode(code)

    const team = await db
      .selectFrom('teams')
      .select(['id', 'receiver_slack_id'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!team) {
      return reply.redirect(`${FRONTEND_URL}/settings?slack_error=no_team`)
    }

    await db
      .insertInto('slack_installs')
      .values({
        team_id: team.id,
        slack_team_id: slackResult.team.id,
        bot_token: slackResult.bot_token,
        bot_user_id: slackResult.bot_user_id,
        installer_slack_id: slackResult.authed_user.id,
      })
      .onConflict(oc =>
        oc.column('slack_team_id').doUpdateSet({
          bot_token: slackResult.bot_token,
          bot_user_id: slackResult.bot_user_id,
          installer_slack_id: slackResult.authed_user.id,
        })
      )
      .execute()

    if (!team.receiver_slack_id && slackResult.authed_user.id) {
      await db
        .updateTable('teams')
        .set({ receiver_slack_id: slackResult.authed_user.id })
        .where('id', '=', team.id)
        .execute()
    }

    return reply.redirect(`${FRONTEND_URL}/settings?slack_connected=true&workspace=${encodeURIComponent(slackResult.team.name)}`)
  } catch (err) {
    request.log.error(err, '[handleSlackCallback] Slack OAuth callback failed')
    return reply.redirect(`${FRONTEND_URL}/settings?slack_error=exchange_failed`)
  }
}
