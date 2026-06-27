import chalk from 'chalk'
import { apiRequest, ApiError, TimeoutError } from '../api/client.js'
import { isAuthenticated } from '../config/store.js'
import type { HandoffBrief } from '@devrelay/shared'

interface HandoffResponse {
  id: string
  status: 'draft' | 'awaiting_review' | 'published'
  brief_body: HandoffBrief | string | null
  created_at: string
  published_at: string | null
  slack_ts: string | null
  author_id: string
}

interface HandoffListResponse {
  items: HandoffResponse[]
  hasMore: boolean
  nextCursor: string | null
}

function printBrief(handoff: HandoffResponse): void {
  // Issue 2: brief_body is stored as JSON string in DB — parse if needed
  const brief: HandoffBrief | null = handoff.brief_body
    ? typeof handoff.brief_body === 'string'
      ? JSON.parse(handoff.brief_body)
      : handoff.brief_body
    : null

  if (!brief) {
    // Issue 3: draft = generation failed, not still in progress
    if (handoff.status === 'draft') {
      console.log(chalk.red('Brief generation failed. Run'), chalk.cyan('devrelay handoff'), chalk.red('to try again.'))
    } else {
      console.log(chalk.yellow('Brief is still generating... Run devrelay read again in a moment.'))
    }
    return
  }

  console.log('')
  console.log(chalk.bold.hex('#6C63FF')('\n■■ What Changed ■■'))
  console.log(brief.what_changed)

  console.log(chalk.bold.hex('#6C63FF')('\n■■ What Failed ■■'))
  console.log(brief.what_failed)

  console.log(chalk.bold.hex('#6C63FF')('\n■■ Decisions Made ■■'))
  console.log(brief.decisions_made)

  console.log(chalk.bold.hex('#6C63FF')('\n■■ Next Steps ■■'))
  console.log(brief.next_steps)

  console.log('')

  const confidenceColor =
    brief.confidence === 'high'
      ? chalk.green
      : brief.confidence === 'medium'
        ? chalk.yellow
        : chalk.red

  console.log(chalk.dim('Confidence:'), confidenceColor(brief.confidence.toUpperCase()))
  console.log(chalk.dim('Status:'), chalk.cyan(handoff.status))

  if (handoff.status === 'awaiting_review') {
    console.log('')
    console.log(
      chalk.dim('Ready to publish. Run'),
      chalk.cyan('devrelay publish ' + handoff.id)
    )
  }

  if (handoff.status === 'published' && handoff.slack_ts) {
    console.log(chalk.dim('Slack delivery confirmed.'))
  }
}

// Issue 4: flush stdout before exit
function safeExit(code: number): void {
  process.stdout.write('', () => process.exit(code))
}

export async function readCommand(id?: string): Promise<void> {
  if (!isAuthenticated()) {
    console.error(chalk.red('Not authenticated. Run devrelay auth login first.'))
    safeExit(1)
    return
  }

  try {
    let handoff: HandoffResponse

    if (id) {
      handoff = await apiRequest<HandoffResponse>(`/handoffs/${id}`)
    } else {
      const list = await apiRequest<HandoffListResponse>('/handoffs?limit=1')

      if (!list.items || list.items.length === 0) {
        console.log(chalk.dim('No handoffs yet. Run'), chalk.cyan('devrelay handoff'), chalk.dim('to create one.'))
        return
      }

      handoff = list.items[0]
    }

    printBrief(handoff)
  } catch (err) {
    // Issue 9: handle timeout + network errors with friendly message
    if (err instanceof TimeoutError) {
      console.error(chalk.red('Request timed out. Check your connection and try again.'))
      safeExit(1)
      return
    }

    if (err instanceof ApiError) {
      if (err.status === 404) {
        console.error(chalk.red('Handoff not found.'), chalk.dim('Check the ID or run'), chalk.cyan('devrelay read'), chalk.dim('to see the latest.'))
        safeExit(1)
        return
      }
      if (err.status === 401) {
        console.error(chalk.red('Session expired. Run devrelay auth login.'))
        safeExit(1)
        return
      }
      console.error(chalk.red('Failed to fetch handoff:'), err.message)
      safeExit(1)
      return
    }

    // Issue 9: catch-all for network errors — no raw stack trace
    console.error(chalk.red('Network error. Check your connection and try again.'))
    safeExit(1)
  }
}
