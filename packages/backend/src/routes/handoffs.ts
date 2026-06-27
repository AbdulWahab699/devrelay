import type { FastifyInstance } from "fastify"
import { authMiddleware } from "../middleware/auth.js"
import { createDraft, getHandoff, listHandoffs } from "../handlers/handoff-handler.js"

export async function handoffRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware)

  app.post("/handoffs/draft", {
    schema: {
      body: {
        type: "object",
        required: ["gitSummary", "terminalCommands", "slackSummary"],
        additionalProperties: false,
        properties: {
          // 5000 chars — generous buffer for real diffs after filtering
          gitSummary: { type: "string", maxLength: 5000 },
          terminalCommands: { type: "array", maxItems: 30 },
          slackSummary: { type: "string", maxLength: 5000 },
          commitMessages: { type: "array", maxItems: 50 },
        },
      },
    },
    handler: createDraft,
  })

  app.get("/handoffs", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "string" },
          cursor: { type: "string" },
          cursorId: { type: "string" },
        },
      },
    },
    handler: listHandoffs,
  })

  app.get("/handoffs/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1 },
        },
      },
    },
    handler: getHandoff,
  })
}