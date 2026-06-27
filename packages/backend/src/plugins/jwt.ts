import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'

export default fp(async function jwtPlugin(app: FastifyInstance) {
  const secret = process.env.JWT_SECRET

  // Edge Case 1: Crash on boot if secret is missing in production.
  // Prevents silent fallback to hardcoded string — an attacker with
  // access to the public repo could forge tokens using that string.
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[FATAL] JWT_SECRET environment variable is not set. ' +
      'Refusing to start in production with an insecure secret.'
    )
  }

  // Edge Case 2 (Horizon): Currently using HS256 (symmetric) — same key
  // signs and verifies. Sufficient for monolithic MVP.
  // Future path: migrate to RS256 (asymmetric) when splitting into
  // microservices, so downstream services verify with public key only.
  app.register(jwt, {
    secret: secret ?? 'dev-secret-change-in-production',
    sign: { expiresIn: '15m' },
  })
})
