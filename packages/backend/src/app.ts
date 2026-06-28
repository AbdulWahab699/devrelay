import Fastify from 'fastify'
import corsPlugin from './plugins/cors.js'
import jwtPlugin from './plugins/jwt.js'
import { authRoutes } from './routes/auth.js'
import { handoffRoutes } from './routes/handoffs.js'
import { slackRoutes } from './routes/slack.js'

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    ajv: {
      customOptions: {
        strict: false,
      },
    },
  })

  // Plugins
  app.register(corsPlugin)
  app.register(jwtPlugin)

  // Routes
  app.register(authRoutes)
  app.register(handoffRoutes)
  app.register(slackRoutes)

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', version: '1.0.0' }
  })

  return app
}
