import { describe, it, afterEach } from "node:test"
import assert from "node:assert"
import { existsSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { saveConfig, loadConfig, clearConfig, isAuthenticated } from "../store.ts"

const CONFIG_DIR = join(homedir(), ".devrelay")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

const mockConfig = {
  jwt: "test-jwt-token",
  refreshToken: "test-refresh-token",
  userId: "user-123",
  teamId: "team-456",
  displayName: "Test User",
  teamSlug: "test-team",
}

describe("config store", () => {
  afterEach(() => {
    clearConfig()
  })

  it("saves and loads config correctly", () => {
    saveConfig(mockConfig)
    const loaded = loadConfig()
    assert.strictEqual(loaded?.jwt, mockConfig.jwt)
    assert.strictEqual(loaded?.displayName, mockConfig.displayName)
    assert.strictEqual(loaded?.teamSlug, mockConfig.teamSlug)
  })

  it("returns null when config file does not exist", () => {
    clearConfig()
    const loaded = loadConfig()
    assert.strictEqual(loaded, null)
  })

  it("returns null for partial config missing jwt", () => {
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify({ userId: "123" }), "utf8")
    const loaded = loadConfig()
    assert.strictEqual(loaded, null)
  })

  it("clearConfig removes the file entirely", () => {
    saveConfig(mockConfig)
    assert.ok(existsSync(CONFIG_FILE))
    clearConfig()
    assert.ok(!existsSync(CONFIG_FILE))
  })

  it("loadConfig returns null after clearConfig", () => {
    saveConfig(mockConfig)
    clearConfig()
    assert.strictEqual(loadConfig(), null)
  })

  it("isAuthenticated returns true when jwt exists", () => {
    saveConfig(mockConfig)
    assert.strictEqual(isAuthenticated(), true)
  })

  it("isAuthenticated returns false when no config", () => {
    clearConfig()
    assert.strictEqual(isAuthenticated(), false)
  })
})