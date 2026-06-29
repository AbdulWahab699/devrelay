import type { FastifyInstance } from 'fastify'
import { db } from '../db/connection.js'
import { authMiddleware } from '../middleware/auth.js'
import { createDraft, getHandoff, listHandoffs, publishHandoff } from '../handlers/handoff-handler.js'

export async function handoffRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  app.post('/handoffs/draft', {
    schema: {
      body: {
        type: 'object',
        required: ['gitSummary', 'terminalCommands', 'slackSummary'],
        additionalProperties: false,
        properties: {
          gitSummary: { type: 'string', maxLength: 1500 },
          terminalCommands: { type: 'array', maxItems: 30 },
          slackSummary: { type: 'string', maxLength: 5000 },
        },
      },
    },
    handler: createDraft,
  })

  app.get('/handoffs', {
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'string' },
          cursor: { type: 'string' },
          cursorId: { type: 'string' },
        },
      },
    },
    handler: listHandoffs,
  })

  app.get('/handoffs/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: getHandoff,
  })

  app.post('/handoffs/:id/publish', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: publishHandoff,
  })


  app.get('/notifications', {
    handler: async (request, reply) => {
      const payload = request.user as { userId: string; teamId: string }
      const events = await db
        .selectFrom('handoff_events')
        .innerJoin('handoffs', 'handoffs.id', 'handoff_events.handoff_id')
        .select(['handoff_events.id', 'handoff_events.handoff_id', 'handoff_events.event_type', 'handoff_events.occurred_at'])
        .where('handoffs.team_id', '=', payload.teamId)
        .orderBy('handoff_events.occurred_at', 'desc')
        .limit(50)
        .execute()
      return reply.send(events)
    },
  })


  app.get('/analytics', {
    handler: async (request, reply) => {
      const payload = request.user as { userId: string; teamId: string }
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const [allHandoffs, publishedThisWeek, allBriefs, recentHandoffs] = await Promise.all([
        db.selectFrom('handoffs')
          .select(db.fn.count('id').as('count'))
          .where('team_id', '=', payload.teamId)
          .executeTakeFirst(),

        db.selectFrom('handoffs')
          .select(db.fn.count('id').as('count'))
          .where('team_id', '=', payload.teamId)
          .where('status', '=', 'published')
          .where('published_at', '>=', sevenDaysAgo)
          .executeTakeFirst(),

        db.selectFrom('handoffs')
          .select('brief_body')
          .where('team_id', '=', payload.teamId)
          .execute(),

        db.selectFrom('handoffs')
          .select('created_at')
          .where('team_id', '=', payload.teamId)
          .where('created_at', '>=', fourteenDaysAgo)
          .execute(),
      ])

      const slackDelivered = await db
        .selectFrom('handoffs')
        .select(db.fn.count('id').as('count'))
        .where('team_id', '=', payload.teamId)
        .where('slack_ts', 'is not', null as any)
        .executeTakeFirst()

      // Avg confidence
      const confidenceMap: Record<string, number> = { high: 3, medium: 2, low: 1 }
      const reverseMap = ['low', 'medium', 'high']
      const scores = allBriefs
        .map(h => confidenceMap[(h.brief_body as any)?.confidence])
        .filter(Boolean)
      const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) - 1
        : -1
      const avgConfidence = avgScore >= 0 ? reverseMap[avgScore].toUpperCase() : '—'

      // Daily counts grouped in JS
      const dailyMap: Record<string, number> = {}
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        dailyMap[d.toISOString().slice(0, 10)] = 0
      }
      recentHandoffs.forEach(h => {
        const key = new Date(h.created_at).toISOString().slice(0, 10)
        if (dailyMap[key] !== undefined) dailyMap[key]++
      })
      const dailyCounts = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

      const total = Number(allHandoffs?.count ?? 0)
      const delivered = Number(slackDelivered?.count ?? 0)

      return reply.send({
        totalHandoffs: total,
        publishedThisWeek: Number(publishedThisWeek?.count ?? 0),
        avgConfidence,
        slackDeliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        dailyCounts,
      })
    },
  })
}
