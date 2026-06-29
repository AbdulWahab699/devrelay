import { Command } from "commander"
import { authLogin, authLogout } from "./commands/auth.js"
import { statusCommand } from "./commands/status.js"
import { handoffCommand } from "./commands/handoff.js"
import { readCommand } from "./commands/read.js"
import { publishCommand } from "./commands/publish.js"
import chalk from "chalk"

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("\nUnexpected error:"), reason)
  process.exit(1)
})

const program = new Command()

program
  .name("devrelay")
  .description("Async handoff intelligence for distributed engineering teams")
  .version("0.0.1")

program
  .command("auth")
  .description("Authentication commands")
  .addCommand(
    new Command("login")
      .description("Authenticate via GitHub OAuth")
      .action(async () => { await authLogin() })
  )
  .addCommand(
    new Command("logout")
      .description("Log out and clear credentials")
      .action(async () => { await authLogout() })
  )

program
  .command("status")
  .description("Show current auth state")
  .action(() => { statusCommand() })

program
  .command("handoff")
  .description("Generate a handoff brief from your current work")
  .action(async () => { await handoffCommand() })

program
  .command("read [id]")
  .description("Read the latest handoff brief or a specific one by ID")
  .action(async (id?: string) => { await readCommand(id) })

program
  .command("publish [id]")
  .description("Publish latest brief to Slack, or a specific one by ID")
  .action(async (id?: string) => { await publishCommand(id) })

program.parse()