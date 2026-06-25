import type { RawCommand } from "../collectors/terminal-collector.ts"
import type { FilteredCommand } from "@devrelay/shared"

const NOISE_PATTERNS = [
  // Fix 2: strict boundaries — only match when these ARE the full command
  /^\b(cd|pwd|clear|echo|cat|man|which|type)\b(\s+.*)?$/,
  /^ls(\s+-[a-z]+)?$/,
  /^git\s+(status|log(\s+--oneline)?|diff\s+--stat)$/,
  /^npm\s+run\s+(dev|start)$/,
  /^yarn\s+(dev|start)$/,
  /^pnpm\s+(dev|start)$/,
  /^code(\s+.*)?$/,
  /^exit$/,
  /^history$/,
]

const SIGNAL_PATTERNS = [
  /^(jest|vitest|npm\s+(run\s+)?test|pnpm\s+test)/,
  /^npx\s+prisma\s+(migrate|db\s+push)/,
  /^git\s+(revert|reset|stash)/,
  /^git\s+checkout\s+-b\s+/,
  /^(curl|wget|http)\s+/,
  /^docker(\s+.*)?$/,
  /^docker-compose(\s+.*)?$/,
  /^(redis-cli|psql|mongosh)/,
  /^(npm\s+install|pnpm\s+add|yarn\s+add)/,
  /^git\s+merge\s+/,
  /^git\s+rebase\s+/,
]

// Fix 1: extract base command stripping any x{n} suffix
function getBaseCommand(cmd: string): string {
  const match = cmd.match(/^(.+?)\s+x\d+$/)
  return match ? match[1].trim() : cmd.trim()
}

export function collapseRepetitions(cmds: RawCommand[]): RawCommand[] {
  const collapsed: RawCommand[] = []

  for (const current of cmds) {
    const last = collapsed[collapsed.length - 1]

    if (last) {
      // Fix 1: compare base commands, not the full string with counter
      const lastBase = getBaseCommand(last.cmd)
      const currentBase = getBaseCommand(current.cmd)

      if (lastBase === currentBase) {
        // Extract current count and increment
        const countMatch = last.cmd.match(/\s+x(\d+)$/)
        const currentCount = countMatch ? parseInt(countMatch[1]) : 1
        collapsed[collapsed.length - 1] = {
          cmd: `${lastBase} x${currentCount + 1}`,
        }
        continue
      }
    }

    collapsed.push({ cmd: current.cmd })
  }

  return collapsed
}

export function filterTerminalCommands(raw: RawCommand[]): FilteredCommand[] {
  // Step 1 — remove noise with strict boundary patterns
  const filtered = raw.filter(
    (entry) => !NOISE_PATTERNS.some((p) => p.test(entry.cmd))
  )

  // Step 2 — collapse repetitions
  const collapsed = collapseRepetitions(filtered)

  // Step 3 — score by signal patterns
  const scored = collapsed.map((entry) => ({
    cmd: entry.cmd,
    signalScore: SIGNAL_PATTERNS.filter((p) => p.test(entry.cmd)).length,
    exit_codes_unavailable: true as const,
  }))

  // Fix 3: do NOT sort — preserve chronological order
  // Use signalScore only to filter out truly zero-value commands
  // when we have more than 30 entries
  if (scored.length <= 30) return scored

  // If over 30 — prefer signal commands but keep chronological order
  // First pass: keep all signal commands (score > 0)
  const signalCommands = scored.filter((c) => c.signalScore > 0)

  // If still over 30 just take last 30 in chronological order
  if (signalCommands.length >= 30) {
    return signalCommands.slice(-30)
  }

  // Fill remaining slots with non-signal commands (most recent first)
  const nonSignalCommands = scored.filter((c) => c.signalScore === 0)
  const slotsLeft = 30 - signalCommands.length
  const fillerCommands = nonSignalCommands.slice(-slotsLeft)

  // Merge back in chronological order using original index
  return scored.filter(
    (c) =>
      signalCommands.includes(c) || fillerCommands.includes(c)
  ).slice(-30)
}