import { readFileSync, statSync } from "fs"
import { homedir } from "os"
import { join } from "path"

export interface RawCommand {
  cmd: string
}

export function detectShell(): "zsh" | "bash" | "unknown" {
  const shell = process.env.SHELL || process.env.ComSpec || ""
  if (shell.includes("zsh")) return "zsh"
  if (shell.includes("bash")) return "bash"
  return "unknown"
}

export function getHistoryPath(shell: "zsh" | "bash" | "unknown"): string {
  const home = homedir()
  if (shell === "zsh") return join(home, ".zsh_history")
  if (shell === "bash") return join(home, ".bash_history")
  return join(
    home,
    "AppData",
    "Roaming",
    "Microsoft",
    "Windows",
    "PowerShell",
    "PSReadLine",
    "ConsoleHost_history.txt"
  )
}

function readHistoryFile(filePath: string): string {
  const rawBuffer = readFileSync(filePath)

  if (rawBuffer[0] === 0xff && rawBuffer[1] === 0xfe) {
    return rawBuffer.toString("utf16le")
  }
  if (rawBuffer[0] === 0xfe && rawBuffer[1] === 0xff) {
    return rawBuffer.swap16().toString("utf16le")
  }
  if (rawBuffer[0] === 0xef && rawBuffer[1] === 0xbb && rawBuffer[2] === 0xbf) {
    return rawBuffer.toString("utf8").slice(1)
  }

  return rawBuffer.toString("utf8")
}

function checkHistoryFreshness(filePath: string): void {
  try {
    const stat = statSync(filePath)
    const ageMs = Date.now() - stat.mtimeMs
    const fiveMinutes = 5 * 60 * 1000
    if (ageMs > fiveMinutes) {
      console.warn(
        "Warning: Shell history file has not been updated recently. " +
        "Commands from your current terminal session may not be included. " +
        "Tip: Run history -a (bash) before devrelay handoff to flush history."
      )
    }
  } catch {
    // Cannot stat file — skip freshness check
  }
}

export function joinZshMultilineCommands(lines: string[]): string[] {
  const joined: string[] = []
  let current = ""

  for (const line of lines) {
    if (line.endsWith("\\")) {
      current += line.slice(0, -1).trim() + " "
    } else {
      current += line.trim()
      if (current.length > 0) {
        joined.push(current)
      }
      current = ""
    }
  }

  if (current.trim().length > 0) {
    joined.push(current.trim())
  }

  return joined
}

export function terminalCollector(): RawCommand[] {
  const shell = detectShell()
  const historyPath = getHistoryPath(shell)

  let raw = ""
  try {
    checkHistoryFreshness(historyPath)
    raw = readHistoryFile(historyPath)
  } catch {
    console.warn(
      `Warning: Could not read shell history from ${historyPath}. ` +
      "Terminal context will be limited."
    )
    return []
  }

  const rawLines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  // Fix: assemble multiline commands FIRST, then slice
  // Slicing before assembly cuts multiline commands at the boundary
  const assembledLines = shell === "zsh"
    ? joinZshMultilineCommands(rawLines)
    : rawLines

  // Now slice last 200 fully-formed commands
  const finalLines = assembledLines.slice(-200)

  const commands = finalLines.map((line) => {
    if (shell === "zsh" && line.startsWith(":")) {
      const semicolonIndex = line.indexOf(";")
      if (semicolonIndex !== -1) {
        return { cmd: line.slice(semicolonIndex + 1).trim() }
      }
    }
    return { cmd: line }
  })

  return commands.filter((c) => c.cmd.length > 0)
}