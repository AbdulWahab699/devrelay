import type { FilteredPayload } from '@devrelay/shared'

// Issue 3: Hard caps as defence-in-depth even if filters already limit
const MAX_GIT = 1500
const MAX_COMMANDS = 30

export function buildHandoffPrompt(payload: FilteredPayload): string {
  const gitSummary = payload.gitSummary?.slice(0, MAX_GIT) ?? ''
  const commands = payload.terminalCommands.slice(0, MAX_COMMANDS)

  // Issue 1: exit_codes_unavailable exists on FilteredCommand (optional boolean)
  const hasExitCodeGap = commands.some(c => c.exit_codes_unavailable === true)

  const exitCodesNote = hasExitCodeGap
    ? 'IMPORTANT: Exit codes are NOT available. Infer failures from repeated commands, FAIL/ERROR keywords, or test runners without success output.'
    : ''

  const commandLines = commands
    .map(c => `  [score:${c.signalScore}] ${c.cmd}`)
    .join('\n')

  // Issue 5: Only include Slack section if there is actual content
  const slackSection = payload.slackSummary?.trim()
    ? `--- SLACK SUMMARY ---\n${payload.slackSummary}`
    : ''

  // Issue 4: Stronger constraint — clarify what Slack CAN and CANNOT influence
  const slackConstraint = payload.slackSummary?.trim()
    ? 'what_changed and what_failed MAY reference Slack context. decisions_made must NOT — it must come from git commits and terminal commands only.'
    : 'decisions_made must come from git commit messages and terminal commands only.'

  return `You are a senior engineer writing a handoff brief for the incoming engineer.
Analyze the developer context below and produce a structured JSON handoff brief.

RULES:
- ${slackConstraint}
- Be concise — each field should be 2-4 sentences maximum
- confidence reflects how complete and clear the context is
- confidence must be exactly one of: high, medium, or low
${exitCodesNote}

--- GIT SUMMARY ---
${gitSummary || 'No git changes detected.'}

--- TERMINAL COMMANDS (signal score descending) ---
${commandLines || 'No terminal commands detected.'}

${slackSection}

Respond with ONLY valid JSON — no markdown fences, no preamble, no explanation:
{
  "what_changed": "string describing what changed",
  "what_failed": "string describing what failed or empty string if nothing failed",
  "decisions_made": "string describing key decisions",
  "next_steps": "string describing what the incoming engineer should do",
  "confidence": "high"
}

Replace the confidence value with medium or low if the context is incomplete or ambiguous.`
}
