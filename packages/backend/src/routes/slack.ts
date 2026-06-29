import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth.js'
import { handleSlackAuthorize, handleSlackStatus, handleSlackCallback } from '../handlers/slack-handler.js'

export async function slackRoutes(app: FastifyInstance) {
  // Public — no auth (Slack redirects here after OAuth)
  app.get('/slack/callback', {
    handler: handleSlackCallback,
  })

  // Protected routes
  app.post('/slack/authorize', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        additionalProperties: false,
        properties: {
          code: { type: 'string', minLength: 1, maxLength: 250 },
        },
      },
    },
    handler: handleSlackAuthorize,
  })

  app.get('/slack/status', {
    preHandler: authMiddleware,
    handler: handleSlackStatus,
  })
}