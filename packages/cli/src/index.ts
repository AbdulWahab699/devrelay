import { Command } from "commander"
import { authLogin, authLogout } from "./commands/auth.ts"
import { statusCommand } from "./commands/status.ts"
import { handoffCommand } from "./commands/handoff.ts"
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
      .action(async () => {
        await authLogin()
      })
  )
  .addCommand(
    new Command("logout")
      .description("Log out and clear credentials")
      .action(async () => {
        await authLogout()
      })
  )

program
  .command("status")
  .description("Show current auth state")
  .action(() => {
    statusCommand()
  })

program
  .command("handoff")
  .description("Generate a handoff brief from your current work")
  .action(async () => {
    await handoffCommand()
  })

program.parse()