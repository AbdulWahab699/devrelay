import chalk from 'chalk'
import { apiRequest, ApiError, TimeoutError } from '../api/client.js'
import { isAuthenticated } from '../config/store.js'

interface PublishResponse {
  success: boolean
  slackTs?: string
  slackDelivered?: boolean
  error?: string
}

// Issue 4: flush stdout before exit
function safeExit(code: number): void {
  process.stdout.write('', () => process.exit(code))
}

// Issue 8: UUID format validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function publishCommand(id: string): Promise<void> {
  if (!isAuthenticated()) {
    console.error(chalk.red('Not authenticated. Run devrelay auth login first.'))
    safeExit(1)
    return
  }

  if (!id || id.trim() === '') {
    console.error(chalk.red('Handoff ID is required. Run'), chalk.cyan('devrelay read'), chalk.red('to find the ID.'))
    safeExit(1)
    return
  }

  // Issue 8: reject non-UUID IDs before any network call
  if (!UUID_RE.test(id.trim())) {
    console.error(chalk.red('Invalid handoff ID format. Expected a UUID like:'), chalk.dim('a1b2c3d4-e5f6-...'))
    safeExit(1)
    return
  }

  try {
    const result = await apiRequest<PublishResponse>(`/handoffs/${id}/publish`, {
      method: 'POST',
    })

    if (result.success && result.slackDelivered !== false) {
      console.log(chalk.green('✓ Brief published. Slack DM sent.'))
    } else if (result.success && result.slackDelivered === false) {
      console.log(chalk.yellow('⚠ Brief published but Slack delivery failed.'))
      console.log(chalk.dim('Brief saved — check web dashboard to resend.'))
    }
  } catch (err) {
    // Issue 9: timeout handling
    if (err instanceof TimeoutError) {
      console.error(chalk.red('Request timed out. Check your connection and try again.'))
      safeExit(1)
      return
    }

    if (err instanceof ApiError) {
      if (err.status === 404) {
        console.error(chalk.red('Handoff not found.'), chalk.dim('Check the ID.'))
        safeExit(1)
        return
      }

      if (err.status === 400) {
        // Issue 7: distinguish already-published from Slack config errors
        // Backend returns 400 for both — check message content to differentiate
        if (err.message.toLowerCase().includes('already published') || err.message.toLowerCase().includes('awaiting_review')) {
          console.error(chalk.red('This handoff has already been published.'))
        } else {
          console.error(chalk.red('Publish failed:'), err.message)
          console.error(chalk.dim('Visit the web dashboard to connect Slack and configure your receiver.'))
        }
        safeExit(1)
        return
      }

      if (err.status === 401) {
        console.error(chalk.red('Session expired. Run devrelay auth login.'))
        safeExit(1)
        return
      }

      console.error(chalk.red('Publish failed:'), err.message)
      safeExit(1)
      return
    }

    // Issue 9: catch-all for network errors
    console.error(chalk.red('Network error. Check your connection and try again.'))
    safeExit(1)
  }
}
