import { describe, it, afterEach } from "node:test"
import assert from "node:assert"
import { saveConfig, clearConfig } from "../../config/store.ts"

const mockConfig = {
  jwt: "test-jwt-token",
  refreshToken: "test-refresh-token",
  userId: "user-123",
  teamId: "team-456",
  displayName: "Abdul Wahab",
  teamSlug: "devrelay-team",
}

describe("statusCommand", () => {
  afterEach(() => {
    clearConfig()
  })

  it("isAuthenticated is true when config exists", async () => {
    saveConfig(mockConfig)
    const { isAuthenticated } = await import("../../config/store.ts")
    assert.strictEqual(isAuthenticated(), true)
  })

  it("isAuthenticated is false after logout", async () => {
    saveConfig(mockConfig)
    clearConfig()
    const { isAuthenticated } = await import("../../config/store.ts")
    assert.strictEqual(isAuthenticated(), false)
  })
})