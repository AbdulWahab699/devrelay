import type { FastifyRequest, FastifyReply } from 'fastify'
import { FilteredPayloadSchema, scrubData } from '@devrelay/shared'
import { buildHandoffPrompt } from '../services/prompt-builder.js'
import { generateBrief, BriefParseError, ClaudeOverloadError } from '../services/anthropic-service.js'
import { db } from '../db/connection.js'

interface JWTPayload {
  userId: string
  teamId: string
  displayName: string
}

export async function createDraft(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload
  const body = request.body as unknown

  // Issue 2: Validate FIRST to reject malformed payloads before doing any work.
  // Scrub runs after validation — the unscrubbed object exists briefly in memory
  // but never touches the DB. Scrub-first would mean scrubbing invalid payloads
  // that we'd reject anyway, wasting cycles.
  const parseResult = FilteredPayloadSchema.safeParse(body)
  if (!parseResult.success) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: `Invalid payload: ${parseResult.error.message}`,
    })
  }

  // Issue 1: scrubData now imported from @devrelay/shared — no cross-package
  // relative imports from backend into CLI source files
  const scrubbedPayload = scrubData(parseResult.data)

  const draft = await db
    .insertInto('handoffs')
    .values({
      team_id: payload.teamId,
      author_id: payload.userId,
      status: 'draft',
      filtered_data: JSON.stringify(scrubbedPayload),
    })
    .returning(['id', 'status', 'created_at'])
    .executeTakeFirstOrThrow()

  // Issue 8: Only log draft_created here. brief_generated is NOT a separate
  // event — integration test (Task 3.4) asserts exactly 2 rows per handoff:
  // draft_created and published. Adding brief_generated would break that assertion.
  await db
    .insertInto('handoff_events')
    .values({
      handoff_id: draft.id,
      event_type: 'draft_created',
      metadata: JSON.stringify({ author_id: payload.userId }),
    })
    .execute()

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

export async function getHandoff(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload
  const { id } = request.params

  // Issue 7: Explicit column select — filtered_data is not returned
  // to frontend since it contains raw terminal/git payload
  const handoff = await db
    .selectFrom('handoffs')
    .select(['id', 'status', 'brief_body', 'created_at', 'published_at', 'slack_ts', 'author_id', 'team_id'])
    .where('id', '=', id)
    .where('team_id', '=', payload.teamId)
    .executeTakeFirst()

  if (!handoff) {
    return reply.status(404).send({
      error: 'Not Found',
      message: `Handoff ${id} not found`,
    })
  }

  return reply.status(200).send(handoff)
}

export async function listHandoffs(
  request: FastifyRequest<{
    Querystring: { limit?: string; cursor?: string; cursorId?: string }
  }>,
  reply: FastifyReply
) {
  const payload = request.user as JWTPayload

  // Issue 5: Lower bound + upper bound on limit
  const limit = Math.max(1, Math.min(Number(request.query.limit ?? 20), 100))
  const cursor = request.query.cursor
  const cursorId = request.query.cursorId

  let query = db
    .selectFrom('handoffs')
    .select(['id', 'status', 'brief_body', 'created_at', 'published_at', 'slack_ts', 'author_id'])
    .where('team_id', '=', payload.teamId)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit + 1)

  if (cursor) {
    // Issue 4: Validate cursor before passing to new Date()
    const cursorDate = new Date(cursor)
    if (isNaN(cursorDate.getTime())) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid cursor value',
      })
    }

    // Issue 3: Stable cursor with (created_at, id) tiebreaker
    // prevents duplicate rows when two handoffs share the same timestamp
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
  const nextCursor = hasMore && lastItem ? String(lastItem.created_at) : null
  const nextCursorId = hasMore && lastItem ? lastItem.id : null

  return reply.status(200).send({
    items,
    nextCursor,
    nextCursorId,
    hasMore,
  })
}
