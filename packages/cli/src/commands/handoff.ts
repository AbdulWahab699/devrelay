import chalk from "chalk"
import ora from "ora"
import { gitCollector, GitError } from "../collectors/git-collector.ts"
import { terminalCollector } from "../collectors/terminal-collector.ts"
import { filterGitDiff } from "../filters/git-filter.ts"
import { filterTerminalCommands } from "../filters/terminal-filter.ts"
import { scrubData } from "../scrubbing/scrub.ts"
import { apiRequest, ApiError, TimeoutError } from "../api/client.ts"
import { isAuthenticated, loadConfig } from "../config/store.ts"
import { FilteredPayloadSchema } from "@devrelay/shared"
import type { HandoffBrief } from "@devrelay/shared"
import { writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const PENDING_DIR = join(homedir(), ".devrelay", "pending")
const MAX_PENDING_FILES = 20

interface DraftResponse {
  id: string
  brief: HandoffBrief
}

// Fix 3: rolling cache — evict oldest file when limit exceeded
function cachePendingPayload(payload: unknown): string {
  mkdirSync(PENDING_DIR, { recursive: true })

  // Read existing cache files and enforce cap
  const existing = readdirSync(PENDING_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: f, path: join(PENDING_DIR, f), mtime: statSync(join(PENDING_DIR, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime) // oldest first

  // Delete oldest files if over limit
  while (existing.length >= MAX_PENDING_FILES) {
    const oldest = existing.shift()
    if (oldest) {
      try { unlinkSync(oldest.path) } catch { /* ignore */ }
    }
  }

  const filename = join(PENDING_DIR, Date.now() + ".json")
  writeFileSync(filename, JSON.stringify(payload, null, 2), "utf8")
  return filename
}

function printBrief(brief: HandoffBrief): void {
  console.log("")
  console.log(chalk.bold.hex("#6C63FF")("── What Changed ──"))
  console.log(brief.what_changed)
  console.log("")
  console.log(chalk.bold.hex("#6C63FF")("── What Failed ──"))
  console.log(brief.what_failed)
  console.log("")
  console.log(chalk.bold.hex("#6C63FF")("── Decisions Made ──"))
  console.log(brief.decisions_made)
  console.log("")
  console.log(chalk.bold.hex("#6C63FF")("── Next Steps ──"))
  console.log(brief.next_steps)
  console.log("")

  const confidenceColor =
    brief.confidence === "high"
      ? chalk.green
      : brief.confidence === "medium"
        ? chalk.yellow
        : chalk.red

  console.log(chalk.dim("Confidence:"), confidenceColor(brief.confidence.toUpperCase()))
  console.log(chalk.dim("Exit codes unavailable — install shell hook for higher accuracy."))
}

export async function handoffCommand(): Promise<void> {
  // Step 1 — auth check
  if (!isAuthenticated()) {
    console.error(chalk.red("Not authenticated. Run devrelay auth login first."))
    process.exit(1)
  }

  loadConfig()!

  console.log(chalk.cyan("Collecting local context..."))

  // Step 2 — collect git + terminal data
  // Note: both collectors run synchronously (execSync) — sequential not parallel
  // Fix 1: comment updated to reflect reality
  // v1.1: refactor to async exec + Promise.all for true parallelism
  let gitSummary = ""
  let commitMessages: string[] = []

  try {
    const gitData = gitCollector()
    gitSummary = filterGitDiff(gitData.diff)
    commitMessages = gitData.commitMessages
  } catch (err) {
    if (err instanceof GitError) {
      // Fix 2: degrade gracefully instead of exiting
      // Terminal data is still valuable even without git context
      console.warn(chalk.yellow("Warning:"), err.message)
      console.warn(chalk.dim("Continuing with terminal context only..."))
      gitSummary = "No git context available — not a git repository or no commits found."
      commitMessages = []
    } else {
      throw err
    }
  }

  const terminalData = terminalCollector()
  const terminalCommands = filterTerminalCommands(terminalData)

  // Step 3 — build + scrub payload
  const rawPayload = {
    gitSummary,
    terminalCommands,
    slackSummary: "",
    commitMessages,
  }

  const scrubbedPayload = scrubData(rawPayload)

  // Step 4 — validate with Zod
  const validation = FilteredPayloadSchema.safeParse(scrubbedPayload)
  if (!validation.success) {
    console.error(chalk.red("Payload validation failed:"), validation.error.message)
    process.exit(1)
  }

  // Step 5 — upload with spinner
  const spinner = ora({
    text: "Analyzing context and generating brief... (~15s)",
    color: "magenta",
  }).start()

  let retries = 0
  const MAX_RETRIES = 2

  while (retries <= MAX_RETRIES) {
    try {
      const result = await apiRequest<DraftResponse>("/handoffs/draft", {
        method: "POST",
        body: JSON.stringify(scrubbedPayload),
      })

      spinner.succeed(chalk.green("Brief generated."))
      printBrief(result.brief)

      console.log("")
      console.log(
        chalk.dim("Run"),
        chalk.cyan("devrelay read " + result.id),
        chalk.dim("to review or"),
        chalk.cyan("devrelay publish " + result.id),
        chalk.dim("to send to Slack.")
      )
      return

    } catch (err) {
      if (err instanceof TimeoutError) {
        spinner.fail(chalk.red("Request timed out."))
        console.error(chalk.dim("Draft may still be processing. Run devrelay status to check."))
        process.exit(1)
      }

      if (err instanceof ApiError) {
        if (err.status === 503 && retries < MAX_RETRIES) {
          retries++
          spinner.text = "Server busy — retrying (" + retries + "/" + MAX_RETRIES + ")..."
          await new Promise((r) => setTimeout(r, 2000 * retries))
          continue
        }

        spinner.fail(chalk.red("Brief generation failed."))
        const cachedPath = cachePendingPayload(scrubbedPayload)
        console.error(chalk.dim("Payload cached to:"), chalk.cyan(cachedPath))
        console.error(chalk.dim("Run devrelay handoff again to retry."))
        process.exit(1)
      }

      spinner.fail(chalk.red("Network error."))
      const cachedPath = cachePendingPayload(scrubbedPayload)
      console.error(chalk.dim("Payload cached to:"), chalk.cyan(cachedPath))
      process.exit(1)
    }
  }
}