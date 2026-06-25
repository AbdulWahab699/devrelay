import { minimatch } from "minimatch"

const NOISE_FILES = [
  "*.lock",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "*.min.js",
  ".eslintrc*",
  ".prettierrc*",
  "dist/*",
  "build/*",
  "coverage/*",
  ".env",
  ".env.*",
  ".env.local",
]

export function isNoiseFile(filePath: string): boolean {
  return NOISE_FILES.some((pattern) =>
    minimatch(filePath, pattern, { matchBase: true })
  )
}

export function isReformatFile(diff: string): boolean {
  const addedLines = (diff.match(/^\+[^+].*/gm) || [])
    .map((l) => l.slice(1).replace(/[\s]/g, "").toLowerCase())
  const removedLines = (diff.match(/^-[^-].*/gm) || [])
    .map((l) => l.slice(1).replace(/[\s]/g, "").toLowerCase())

  const total = addedLines.length + removedLines.length
  if (total < 50) return false

  // Line counts must be equal for a pure reformat
  // A formatter removes a line and adds it back reformatted — always 1:1
  if (addedLines.length !== removedLines.length) return false

  const ratio =
    Math.min(addedLines.length, removedLines.length) /
    Math.max(addedLines.length, removedLines.length)
  if (ratio <= 0.85) return false

  // Sort both and compare — pure reformat has same content, different whitespace
  const sortedAdded = [...addedLines].sort().join("")
  const sortedRemoved = [...removedLines].sort().join("")

  return sortedAdded === sortedRemoved
}

function truncateAtLineBreak(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str

  let cutIndex = maxLength
  while (cutIndex > 0 && str[cutIndex] !== "\n") {
    cutIndex--
  }

  if (cutIndex === 0) cutIndex = maxLength

  let cleanSlice = str.slice(0, cutIndex)
  if (cleanSlice.endsWith("\r")) {
    cleanSlice = cleanSlice.slice(0, -1)
  }

  return cleanSlice + "\n... (truncated)"
}

export function filterGitDiff(rawDiff: string): string {
  if (!rawDiff.trim()) return "No code changes detected today."

  const fileChunks = rawDiff.split(/^diff --git/m).filter(Boolean)
  const kept: string[] = []

  for (const chunk of fileChunks) {
    const match = chunk.match(/a\/(.+?)\s+b\//)
    const filePath = match ? match[1] : ""

    if (filePath && isNoiseFile(filePath)) continue
    if (isReformatFile(chunk)) continue

    kept.push(chunk)
  }

  if (kept.length === 0) return "No significant code changes detected."

  const result = ("diff --git" + kept.join("\ndiff --git")).trim()
  return truncateAtLineBreak(result, 1500)
}