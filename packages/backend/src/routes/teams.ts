import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/connection.js'

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  app.put('/teams/current', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          slug: { type: 'string', minLength: 1, maxLength: 100 },
          receiverSlackId: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      const payload = request.user as { userId: string; teamId: string }
      const body = request.body as {
        name?: string
        slug?: string
        receiverSlackId?: string
      }

      const updateData: Record<string, string> = {}
      if (body.name) updateData.name = body.name
      if (body.slug) updateData.slug = body.slug
      if (body.receiverSlackId) updateData.receiver_slack_id = body.receiverSlackId

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'No fields to update' })
      }

      await db
        .updateTable('teams')
        .set(updateData)
        .where('id', '=', payload.teamId)
        .execute()

      const team = await db
        .selectFrom('teams')
        .selectAll()
        .where('id', '=', payload.teamId)
        .executeTakeFirst()

      return reply.status(200).send({ success: true, team })
    },
  })

  app.get('/teams/current', {
    handler: async (request, reply) => {
      const payload = request.user as { userId: string; teamId: string }

      const team = await db
        .selectFrom('teams')
        .selectAll()
        .where('id', '=', payload.teamId)
        .executeTakeFirst()

      if (!team) {
        return reply.status(404).send({ error: 'Not Found', message: 'Team not found' })
      }

      return reply.status(200).send(team)
    },
  })
}
