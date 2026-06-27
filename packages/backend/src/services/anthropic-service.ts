import Anthropic from "@anthropic-ai/sdk"
import { HandoffBriefSchema } from "@devrelay/shared"
import type { HandoffBrief } from "@devrelay/shared"

export class BriefParseError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string
  ) {
    super(message)
    this.name = "BriefParseError"
  }
}

export class ClaudeOverloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClaudeOverloadError"
  }
}

// Mock brief — used when ANTHROPIC_API_KEY is not set
const MOCK_BRIEF: HandoffBrief = {
  what_changed:
    "Refactored authentication module — added JWT refresh token rotation and updated GitHub OAuth device flow. Modified 4 files in packages/cli/src/commands.",
  what_failed:
    "No failures detected — terminal patterns show successful test runs. Note: exit codes unavailable, inferred from command patterns.",
  decisions_made:
    "Chose synchronous Claude call over BullMQ queue for MVP simplicity. Decided to use Kysely over Prisma to keep CLI cold start under 800ms.",
  next_steps:
    "Wire up POST /handoffs/draft endpoint to Claude service. Implement devrelay read command to render brief in terminal.",
  confidence: "medium",
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("[FATAL] ANTHROPIC_API_KEY is not set.")
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export async function generateBrief(prompt: string): Promise<HandoffBrief> {
  // Mock mode — returns hardcoded brief when API key not set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[MOCK] ANTHROPIC_API_KEY not set — returning mock brief")
    await new Promise((r) => setTimeout(r, 2000))
    return MOCK_BRIEF
  }

  const client = getClient()
  let response: Anthropic.Message

  try {
    response = await client.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      },
      { timeout: 25000 }
    )
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError && (err.status === 529 || err.status === 503)) {
      throw new ClaudeOverloadError(
        "Anthropic API is currently overloaded. Your draft is saved — retry shortly."
      )
    }

    if (
      err instanceof Error && (
        err.name === "AbortError" ||
        err.message?.includes("timeout") ||
        err.message?.includes("ETIMEDOUT")
      )
    ) {
      throw new ClaudeOverloadError(
        "Anthropic API request timed out. Your draft is saved — retry shortly."
      )
    }

    throw err
  }

  if (response.stop_reason === "max_tokens") {
    const rawText = response.content
      .filter(block => block.type === "text")
      .map(block => (block as Anthropic.TextBlock).text)
      .join("")
    throw new BriefParseError(
      "Claude response was truncated at max_tokens limit — brief is incomplete",
      rawText
    )
  }

  const rawText = response.content
    .filter(block => block.type === "text")
    .map(block => (block as Anthropic.TextBlock).text)
    .join("")

  const totalTokens = response.usage.input_tokens + response.usage.output_tokens
  console.log("[anthropic] tokens used: input=" + response.usage.input_tokens + " output=" + response.usage.output_tokens + " total=" + totalTokens)
  if (totalTokens > 2500) {
    console.warn("[anthropic] WARNING: token usage " + totalTokens + " exceeds 2500 threshold")
  }

  const cleaned = rawText
    .replace(/.*?```(?:json)?\s*/is, "")
    .replace(/\s*```[\s\S]*$/i, "")
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new BriefParseError(
      "Claude returned invalid JSON — cannot parse brief",
      rawText
    )
  }

  const result = HandoffBriefSchema.safeParse(parsed)
  if (!result.success) {
    throw new BriefParseError(
      "Claude brief failed schema validation: " + result.error.message,
      rawText
    )
  }

  return result.data
}