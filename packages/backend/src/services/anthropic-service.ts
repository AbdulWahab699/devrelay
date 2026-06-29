import { GoogleGenerativeAI } from '@google/generative-ai'
import { HandoffBriefSchema } from '@devrelay/shared'
import type { HandoffBrief } from '@devrelay/shared'

export class BriefParseError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string
  ) {
    super(message)
    this.name = 'BriefParseError'
  }
}

export class ClaudeOverloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClaudeOverloadError'
  }
}

const MOCK_BRIEF: HandoffBrief = {
  what_changed:
    'Completed full implementation of the JWT authentication middleware with token rotation support. Refactored the Kysely database connection pool configuration to increase max connections from 5 to 10 for better concurrency under load. Added server-side scrubbing of sensitive data before storing FilteredPayload in the handoffs table. Updated the Fastify route schema for POST /handoffs/draft to enforce strict input validation with maxLength constraints on gitSummary and terminalCommands fields.',
  what_failed:
    'Initial integration test run failed due to a missing postcss.config.cjs file in the backend package — Vitest was crawling up to the web package and picking up its Vite configuration, causing an unhandled PostCSS rejection. Fixed by placing an empty CJS module export in the backend root. A secondary failure occurred when the refresh token rotation endpoint returned 500 instead of 401 for expired tokens — root cause was the forUpdate() row lock firing outside a transaction context, resolved by wrapping the full validation sequence in db.transaction().execute().',
  decisions_made:
    'Chose to implement token rotation using a database transaction with a row-level lock (SELECT ... FOR UPDATE) instead of a grace period window, as the atomic approach eliminates the race condition entirely rather than masking it. Decided to store brief_body as a JSON string in PostgreSQL text column rather than native JSONB to keep Kysely type inference clean.',
  next_steps:
    'Wire up the Slack OAuth callback route on the frontend. After Slack is connected end-to-end, run devrelay publish on an existing awaiting_review handoff to verify the Block Kit DM delivery. Then move to deployment — set up Fly.io for the backend and Vercel for the frontend.',
  confidence: 'high',
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('[FATAL] GEMINI_API_KEY is not set.')
  return new GoogleGenerativeAI(apiKey)
}

export async function generateBrief(prompt: string): Promise<HandoffBrief> {
  // Mock mode — returns hardcoded brief when GEMINI_API_KEY is not set
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[MOCK] GEMINI_API_KEY not set — returning mock brief')
    await new Promise(r => setTimeout(r, 1500))
    return MOCK_BRIEF
  }

  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  let rawText: string

  try {
    const result = await model.generateContent(prompt)
    rawText = result.response.text()
  } catch (err: unknown) {
    if (err instanceof Error && (
      err.message?.includes('503') ||
      err.message?.includes('overloaded') ||
      err.message?.includes('UNAVAILABLE')
    )) {
      throw new ClaudeOverloadError(
        'Gemini API is currently overloaded. Your draft is saved — retry shortly.'
      )
    }

    if (err instanceof Error && (
      err.name === 'AbortError' ||
      err.message?.includes('timeout') ||
      err.message?.includes('ETIMEDOUT')
    )) {
      throw new ClaudeOverloadError(
        'Gemini API request timed out. Your draft is saved — retry shortly.'
      )
    }

    throw err
  }

  console.log('[gemini] response received, length=' + rawText.length)

  // Strip markdown fences if present
  const cleaned = rawText
    .replace(/.*?```(?:json)?\s*/is, '')
    .replace(/\s*```[\s\S]*$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new BriefParseError(
      'Gemini returned invalid JSON — cannot parse brief',
      rawText
    )
  }

  const result = HandoffBriefSchema.safeParse(parsed)
  if (!result.success) {
    throw new BriefParseError(
      'Gemini brief failed schema validation: ' + result.error.message,
      rawText
    )
  }

  return result.data
}
