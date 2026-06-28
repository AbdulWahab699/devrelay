import type { FastifyRequest, FastifyReply } from 'fastify'
import { FilteredPayloadSchema, scrubData } from '@devrelay/shared'
import { buildHandoffPrompt } from '../services/prompt-builder.js'
import { generateBrief, BriefParseError, ClaudeOverloadError } from '../services/anthropic-service.js'
import { buildHandoffBlocks, sendHandoffDM, SlackDeliveryError } from '../services/slack-service.js'
import { db } from '../db/connection.js'
import type { HandoffBrief } from '@devrelay/shared'

interface JWTPayload {
  userId: string
  teamId: string
  displayName: string
}

// Issue 6: consistent column set used by both list and detail
const HANDOFF_COLUMNS = [
  'id',
  'status',
  'brief_body',
  'created_at',
  'published_at',
  'slack_ts',
  'author_id',
  'team_id',
] as const

export async function createDraft(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload
  const body = request.body as unknown

  const parseResult = FilteredPayloadSchema.safeParse(body)
  if (!parseResult.success) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: `Invalid payload: ${parseResult.error.message}`,
    })
  }

  const scrubbedPayload = scrubData(parseResult.data)

  // Issue 1: wrap pre-Claude DB operations in try/catch
  // FK constraint failures, pool exhaustion, or DB outages all surface cleanly
  let draft: { id: string; status: string; created_at: Date }
  try {
    draft = await db
      .insertInto('handoffs')
      .values({
        team_id: payload.teamId,
        author_id: payload.userId,
        status: 'draft',
        filtered_data: JSON.stringify(scrubbedPayload),
      })
      .returning(['id', 'status', 'created_at'])
      .executeTakeFirstOrThrow()

    await db
      .insertInto('handoff_events')
      .values({
        handoff_id: draft.id,
        event_type: 'draft_created',
        metadata: JSON.stringify({ author_id: payload.userId }),
      })
      .execute()
  } catch (err) {
    request.log.error(err, '[createDraft] DB error during draft insert')
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create draft. Please try again.',
    })
  }

  try {
    const prompt = buildHandoffPrompt(scrubbedPayload)
    const brief = await generateBrief(prompt)

    await db
      .updateTable('handoffs')
      .set({
        brief_body: JSON.stringify(brief),
        status: 'awaiting_review',
      })
      .where('id', '=', draft.id)
      .execute()

    // Issue 8: log brief_generated event — provides audit trail
    // Integration test updated to expect 3 events: draft_created, brief_generated, published
    await db
      .insertInto('handoff_events')
      .values({
        handoff_id: draft.id,
        event_type: 'brief_generated',
        metadata: JSON.stringify({ confidence: brief.confidence }),
      })
      .execute()

    return reply.status(200).send({
      id: draft.id,
      brief,
      status: 'awaiting_review',
    })
  } catch (err) {
    if (err instanceof ClaudeOverloadError) {
      await db
        .insertInto('handoff_events')
        .values({
          handoff_id: draft.id,
          event_type: 'brief_failed',
          metadata: JSON.stringify({ reason: 'claude_overload', message: err.message }),
        })
        .execute()

      return reply.status(503).send({
        error: 'Service Unavailable',
        message: err.message,
        draftId: draft.id,
      })
    }

    if (err instanceof BriefParseError) {
      await db
        .updateTable('handoffs')
        .set({ status: 'draft' })
        .where('id', '=', draft.id)
        .execute()

      await db
        .insertInto('handoff_events')
        .values({
          handoff_id: draft.id,
          event_type: 'brief_failed',
          metadata: JSON.stringify({ reason: 'parse_error', raw: err.rawOutput.slice(0, 500) }),
        })
        .execute()

      request.log.error(err, '[createDraft] Claude returned unparseable brief')
      return reply.status(422).send({
        error: 'Brief Parse Error',
        message: 'Claude returned an invalid brief. Your draft is saved. Run devrelay handoff again to retry.',
        draftId: draft.id,
      })
    }

    request.log.error(err, '[createDraft] Unexpected error during draft creation')
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Draft creation failed. Please try again.',
      draftId: draft.id,
    })
  }
}

export async function publishHandoff(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload
  const { id } = request.params

  // Fetch handoff first — verify ownership and status
  const handoff = await db
    .selectFrom('handoffs')
    .selectAll()
    .where('id', '=', id)
    .where('team_id', '=', payload.teamId)
    .executeTakeFirst()

  if (!handoff) {
    return reply.status(404).send({
      error: 'Not Found',
      message: `Handoff ${id} not found`,
    })
  }

  // Issue 4: 409 for already-published, 400 for draft
  if (handoff.status === 'published') {
    return reply.status(409).send({
      error: 'Conflict',
      message: 'This handoff has already been published.',
    })
  }

  if (handoff.status !== 'awaiting_review') {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Handoff is not ready to publish. Brief may still be generating.',
    })
  }

  // Issue 2: slackInstall and team fetched in parallel
  const [slackInstall, team] = await Promise.all([
    db
      .selectFrom('slack_installs')
      .selectAll()
      .where('team_id', '=', payload.teamId)
      .executeTakeFirst(),
    db
      .selectFrom('teams')
      .select(['receiver_slack_id', 'name'])
      .where('id', '=', payload.teamId)
      .executeTakeFirst(),
  ])

  if (!slackInstall) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Slack not connected. Visit /settings to connect.',
    })
  }

  if (!team?.receiver_slack_id) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Receiver not configured. Visit /settings.',
    })
  }

  // Issue 3: guard JSON.parse on brief_body
  let brief: HandoffBrief
  try {
    brief = typeof handoff.brief_body === 'string'
      ? JSON.parse(handoff.brief_body)
      : handoff.brief_body as HandoffBrief
  } catch {
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Brief data is corrupted. Contact support.',
      draftId: id,
    })
  }

  const blocks = buildHandoffBlocks(
    brief,
    handoff.id,
    payload.displayName,
    new Date(handoff.created_at)
  )

  try {
    const slackTs = await sendHandoffDM(
      team.receiver_slack_id,
      blocks,
      slackInstall.bot_token
    )

    await db
      .updateTable('handoffs')
      .set({
        status: 'published',
        published_at: new Date(),
        slack_ts: slackTs,
      })
      .where('id', '=', handoff.id)
      .execute()

    await db
      .insertInto('handoff_events')
      .values({
        handoff_id: handoff.id,
        event_type: 'published',
        metadata: JSON.stringify({ slack_ts: slackTs }),
      })
      .execute()

    return reply.status(200).send({
      success: true,
      slackTs,
    })
  } catch (err) {
    if (err instanceof SlackDeliveryError) {
      // Issue 5: slack_ts stays null on failure — documented as known limitation
      // v1.1: add slack_delivered boolean column to distinguish never-sent from sent
      await db
        .updateTable('handoffs')
        .set({
          status: 'published',
          published_at: new Date(),
        })
        .where('id', '=', handoff.id)
        .execute()

      await db
        .insertInto('handoff_events')
        .values({
          handoff_id: handoff.id,
          event_type: 'slack_failed',
          metadata: JSON.stringify({ error: err.message }),
        })
        .execute()

      request.log.error(err, '[publishHandoff] Slack delivery failed')
      return reply.status(200).send({
        success: true,
        slackDelivered: false,
        error: 'Slack delivery failed',
      })
    }

    request.log.error(err, '[publishHandoff] Unexpected error during publish')
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Publish failed. Please try again.',
    })
  }
}

export async function getHandoff(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload
  const { id } = request.params

  const handoff = await db
    .selectFrom('handoffs')
    .select(HANDOFF_COLUMNS)
    .where('id', '=', id)
    .where('team_id', '=', payload.teamId)
    .executeTakeFirst()

  if (!handoff) {
    return reply.status(404).send({
      error: 'Not Found',
      message: `Handoff ${id} not found`,
    })
  }

  // Issue 9: parse brief_body before sending — frontend receives object not string
  return reply.status(200).send({
    ...handoff,
    brief_body: typeof handoff.brief_body === 'string'
      ? JSON.parse(handoff.brief_body)
      : handoff.brief_body,
  })
}

export async function listHandoffs(
  request: FastifyRequest<{
    Querystring: { limit?: string; cursor?: string; cursorId?: string }
  }>,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload
  const limit = Math.max(1, Math.min(Number(request.query.limit ?? 20), 100))
  const cursor = request.query.cursor
  const cursorId = request.query.cursorId

  let query = db
    .selectFrom('handoffs')
    .select(HANDOFF_COLUMNS)
    .where('team_id', '=', payload.teamId)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit + 1)

  if (cursor) {
    const cursorDate = new Date(cursor)
    if (isNaN(cursorDate.getTime())) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid cursor value',
      })
    }

    if (cursorId) {
      query = query.where((eb) =>
        eb.or([
          eb('created_at', '<', cursorDate),
          eb.and([
            eb('created_at', '=', cursorDate),
            eb('id', '<', cursorId),
          ]),
        ])
      )
    } else {
      query = query.where('created_at', '<', cursorDate)
    }
  }

  const rows = await query.execute()
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const lastItem = items[items.length - 1]

  // Issue 7: ISO format for cursor — consistent across environments
  const nextCursor = hasMore && lastItem
    ? new Date(lastItem.created_at).toISOString()
    : null
  const nextCursorId = hasMore && lastItem ? lastItem.id : null

  return reply.status(200).send({
    items,
    nextCursor,
    nextCursorId,
    hasMore,
  })
}
