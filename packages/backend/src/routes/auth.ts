import type { FastifyInstance } from "fastify"
import { authMiddleware } from "../middleware/auth.js"
import {
  handleGitHubAuth,
  handleGitHubDeviceAuth,
  handleRefresh,
  handleMe,
} from "../handlers/auth-handler.js"

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/github — web OAuth flow (expects { code })
  app.post("/auth/github", {
    schema: {
      body: {
        type: "object",
        required: ["code"],
        additionalProperties: false,
        properties: {
          code: { type: "string", minLength: 1, maxLength: 250 },
        },
      },
    },
    handler: handleGitHubAuth,
  })

  // POST /auth/github/device — device flow (expects { accessToken })
  app.post("/auth/github/device", {
    schema: {
      body: {
        type: "object",
        required: ["accessToken"],
        additionalProperties: false,
        properties: {
          accessToken: { type: "string", minLength: 1, maxLength: 500 },
        },
      },
    },
    handler: handleGitHubDeviceAuth,
  })

  // POST /auth/refresh
  app.post("/auth/refresh", {
    schema: {
      body: {
        type: "object",
        required: ["refreshToken"],
        additionalProperties: false,
        properties: {
          refreshToken: { type: "string", minLength: 1, maxLength: 250 },
        },
      },
    },
    handler: handleRefresh,
  })

  // GET /auth/me
  app.get("/auth/me", {
    preHandler: authMiddleware,
    handler: handleMe,
  })
}