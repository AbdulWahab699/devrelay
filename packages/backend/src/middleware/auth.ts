import type { FastifyRequest, FastifyReply } from 'fastify'

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify()
  } catch (err: unknown) {
    // Edge Case 2: Distinguish JWT auth failures from server faults.
    // A JWT error means the token is invalid/expired — send 401.
    // Any other error is a server fault (corrupted secrets, OOM, etc.)
    // — log it and send 500 so it surfaces in monitoring, not silently
    // swallowed as a fake "please login" message.
    const isJwtError =
      err instanceof Error &&
      (err.message.includes('Unauthorized') ||
        (err as any).code?.startsWith('FST_JWT'))

    if (isJwtError) {
      // Edge Case 1: return is critical here. Without it, Fastify continues
      // executing into the route handler even after sending 401, causing
      // request.user to be undefined and crashing with a 500.
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Run devrelay auth login',
      })
    }

    // Server fault — log and return 500
    request.log.error(err, '[authMiddleware] Unexpected server fault during JWT verification')
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    })
  }
}
