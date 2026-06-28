import { WebClient } from '@slack/web-api'
import type { KnownBlock } from '@slack/web-api'
import type { HandoffBrief } from '@devrelay/shared'

export interface SlackOAuthResult {
  bot_token: string
  bot_user_id: string
  team: { id: string; name: string }
  authed_user: { id: string }
}

export class SlackServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'SlackServiceError'
  }
}

export class SlackDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlackDeliveryError'
  }
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResult> {
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
    throw new SlackServiceError('[FATAL] SLACK_CLIENT_ID or SLACK_CLIENT_SECRET is not set', 500)
  }

  const client = new WebClient()

  const result = await client.oauth.v2.access({
    client_id: process.env.SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET,
    code,
  })

  if (!result.ok || !result.access_token || !result.team || !result.bot_user_id) {
    throw new SlackServiceError(
      `Slack OAuth failed: ${result.error ?? 'unknown error'}`,
      400
    )
  }

  // Issue 7: throw explicitly if authed_user.id is missing
  // rather than silently defaulting to empty string which causes
  // "channel not found" errors on DM delivery later
  const authedUserId = result.authed_user?.id
  if (!authedUserId) {
    throw new SlackServiceError('Slack OAuth did not return authed_user.id', 400)
  }

  return {
    bot_token: result.access_token,
    bot_user_id: result.bot_user_id,
    team: {
      id: result.team.id ?? '',
      name: result.team.name ?? '',
    },
    authed_user: { id: authedUserId },
  }
}

// Issue 3: createdAt param added — timestamp reflects handoff creation not build time
// Issue 4: header text truncated to 150 chars — Slack Block Kit hard limit
// Issue 5: section fields truncated to 2900 chars — Slack section hard limit is 3000
export function buildHandoffBlocks(
  brief: HandoffBrief,
  handoffId: string,
  authorName: string,
  createdAt: Date
): KnownBlock[] {
  const timestamp = createdAt.toUTCString()
  const headerText = `DevRelay Handoff — ${authorName} — ${timestamp}`.slice(0, 150)

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
        emoji: true,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*What Changed*\n${brief.what_changed.slice(0, 2900)}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*What Failed*\n${brief.what_failed.slice(0, 2900)}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Decisions Made*\n${brief.decisions_made.slice(0, 2900)}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Next Steps*\n${brief.next_steps.slice(0, 2900)}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Confidence:* ${brief.confidence.toUpperCase()} | Exit codes unavailable — inferred from terminal patterns`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<https://devrelay.app/handoffs/${handoffId}|Archive →>`,
      },
    },
  ]
}

export async function sendHandoffDM(
  receiverSlackId: string,
  blocks: KnownBlock[],
  botToken: string
): Promise<string> {
  // Issue 6: noted — for MVP a new client per call is acceptable.
  // v1.1: cache clients by botToken for connection reuse + shared rate limit tracking
  const client = new WebClient(botToken)

  try {
    const result = await client.chat.postMessage({
      channel: receiverSlackId,
      blocks,
      text: 'New DevRelay handoff brief',
    })

    if (!result.ok || !result.ts) {
      throw new SlackDeliveryError(`Slack postMessage failed: ${result.error ?? 'unknown error'}`)
    }

    return result.ts
  } catch (err) {
    if (err instanceof SlackDeliveryError) throw err
    throw new SlackDeliveryError(`Slack DM delivery failed: ${(err as Error).message}`)
  }
}
