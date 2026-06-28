import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth.js'
import { handleSlackAuthorize, handleSlackStatus } from '../handlers/slack-handler.js'

export async function slackRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  // POST /slack/authorize — exchange Slack OAuth code, store install
  app.post('/slack/authorize', {
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

  // GET /slack/status — check if team has connected Slack
  app.get('/slack/status', {
    handler: handleSlackStatus,
  })
}
