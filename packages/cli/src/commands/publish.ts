import chalk from "chalk"
import { apiRequest, ApiError, TimeoutError } from "../api/client.js"
import { isAuthenticated } from "../config/store.js"

interface PublishResponse {
  success: boolean
  slackTs?: string
  slackDelivered?: boolean
  error?: string
}

interface HandoffListResponse {
  handoffs: { id: string; status: string; created_at: string }[]
}

function safeExit(code: number): void {
  process.stdout.write("", () => process.exit(code))
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveHandoffId(id?: string): Promise<string | null> {
  // If valid UUID provided — use it directly
  if (id && UUID_RE.test(id.trim())) return id.trim()

  // No ID — fetch latest awaiting_review handoff automatically
  try {
    const result = await apiRequest<HandoffListResponse>("/handoffs?limit=5")
    const pending = result.handoffs?.find((h) => h.status === "awaiting_review")
    if (pending) return pending.id
    return null
  } catch {
    return null
  }
}

export async function publishCommand(id?: string): Promise<void> {
  if (!isAuthenticated()) {
    console.error(chalk.red("Not authenticated. Run devrelay auth login first."))
    safeExit(1)
    return
  }

  // If ID provided but invalid format — reject early
  if (id && !UUID_RE.test(id.trim())) {
    console.error(chalk.red("Invalid handoff ID format. Expected a UUID like:"), chalk.dim("a1b2c3d4-e5f6-..."))
    safeExit(1)
    return
  }

  const resolvedId = await resolveHandoffId(id)

  if (!resolvedId) {
    console.error(chalk.red("No handoff ready to publish."))
    console.error(chalk.dim("Run devrelay handoff first to generate a brief."))
    safeExit(1)
    return
  }

  // Tell user which brief is being published when auto-resolved
  if (!id) {
    console.log(chalk.dim("Auto-resolved latest brief: " + resolvedId))
  }

  try {
    const result = await apiRequest<PublishResponse>("/handoffs/" + resolvedId + "/publish", {
      method: "POST",
    })

    if (result.success && result.slackDelivered !== false) {
      console.log(chalk.green("✓ Brief published. Slack DM sent."))
    } else if (result.success && result.slackDelivered === false) {
      console.log(chalk.yellow("⚠ Brief published but Slack delivery failed."))
      console.log(chalk.dim("Brief saved — check web dashboard to resend."))
    }
  } catch (err) {
    if (err instanceof TimeoutError) {
      console.error(chalk.red("Request timed out. Check your connection and try again."))
      safeExit(1)
      return
    }

    if (err instanceof ApiError) {
      if (err.status === 404) {
        console.error(chalk.red("Handoff not found."), chalk.dim("Check the ID."))
        safeExit(1)
        return
      }
      if (err.status === 400) {
        if (err.message.toLowerCase().includes("already published") || err.message.toLowerCase().includes("awaiting_review")) {
          console.error(chalk.red("This handoff has already been published."))
        } else {
          console.error(chalk.red("Publish failed:"), err.message)
          console.error(chalk.dim("Visit the web dashboard to connect Slack and configure your receiver."))
        }
        safeExit(1)
        return
      }
      if (err.status === 401) {
        console.error(chalk.red("Session expired. Run devrelay auth login."))
        safeExit(1)
        return
      }
      console.error(chalk.red("Publish failed:"), err.message)
      safeExit(1)
      return
    }

    console.error(chalk.red("Network error. Check your connection and try again."))
    safeExit(1)
  }
}