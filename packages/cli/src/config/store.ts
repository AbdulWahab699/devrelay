import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const CONFIG_DIR = join(homedir(), ".devrelay")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

export interface Config {
  jwt: string
  refreshToken: string
  userId: string
  teamId: string
  displayName: string
  teamSlug: string
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    encoding: "utf8",
    // Note: mode 0o600 applies on Linux/macOS only
    // Windows does not enforce POSIX file permissions via this flag
    // v1.1: add icacls ACL enforcement for Windows enterprise deployments
    mode: 0o600,
  })
}

export function loadConfig(): Config | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8")
    const parsed = JSON.parse(raw) as Partial<Config>
    // Guard against empty or partial config — must have jwt at minimum
    if (!parsed.jwt) return null
    return parsed as Config
  } catch {
    return null
  }
}

export function clearConfig(): void {
  // Fix 2: unlink the file entirely instead of writing empty object
  // This guarantees loadConfig() returns null after logout
  // Writing {} leaves an empty object that can cause undefined property errors
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE)
  }
}

export function isAuthenticated(): boolean {
  const config = loadConfig()
  return config !== null && Boolean(config.jwt)
}