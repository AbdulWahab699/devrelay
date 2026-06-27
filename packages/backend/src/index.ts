import 'dotenv/config'
import { buildApp } from './app.js'

const app = buildApp()
const port = Number(process.env.PORT ?? 3001)

const start = async () => {
  try {
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`DevRelay API running on http://localhost:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Edge Case 2: Bind to both SIGTERM (production/container shutdown)
// and SIGINT (Ctrl+C in local dev) so graceful cleanup always runs.
const shutdown = async () => {
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

start()
