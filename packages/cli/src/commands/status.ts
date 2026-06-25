import { loadConfig } from "../config/store.ts"
import chalk from "chalk"

export function statusCommand(): void {
  const config = loadConfig()

  if (!config?.jwt) {
    console.log(chalk.yellow("Not authenticated."))
    console.log(chalk.dim("Run devrelay auth login to get started."))
    return
  }

  // Known limitation: JWT validity is not verified against backend
  // v1.1: add lightweight GET /auth/me check with offline fallback
  console.log(chalk.bold("DevRelay Status"))
  console.log(chalk.dim("─────────────────────────────"))
  // Fix 2: removed chalk.white — let terminal default color render text
  // chalk.white breaks on light-themed terminals (PowerShell default)
  console.log(chalk.dim("User:    "), chalk.bold(config.displayName))
  console.log(chalk.dim("Team:    "), chalk.bold(config.teamSlug))
  console.log(chalk.dim("API:     "), process.env.DEVRELAY_API_URL ?? "http://localhost:3001")
}