import { describe, it } from "node:test"
import assert from "node:assert"
import { scrubData, hasSensitiveContent } from "./scrub.ts"

describe("scrubData", () => {
  it("redacts Anthropic API key", () => {
    const data = { cmd: "export API_KEY=sk-ant-abcdefghijklmnopqrstuvwxyz123456" }
    const result = scrubData(data)
    assert.ok(!JSON.stringify(result).includes("sk-ant-"))
    assert.ok(JSON.stringify(result).includes("[REDACTED_ANT_KEY]"))
  })

  it("redacts GitHub PAT", () => {
    const data = { cmd: "git clone https://ghp_abcdefghijklmnopqrstuvwxyz1234567890@github.com" }
    const result = scrubData(data)
    assert.ok(!JSON.stringify(result).includes("ghp_"))
    assert.ok(JSON.stringify(result).includes("[REDACTED_GH_PAT]"))
  })

  it("redacts Slack token", () => {
    const data = { cmd: "slack token xoxb-123456789-abcdefghij" }
    const result = scrubData(data)
    assert.ok(!JSON.stringify(result).includes("xoxb-"))
    assert.ok(JSON.stringify(result).includes("[REDACTED_SLACK_TOKEN]"))
  })

  it("redacts AWS access key", () => {
    const data = { token: "AKIAIOSFODNN7EXAMPLE" }
    const result = scrubData(data)
    assert.ok(!JSON.stringify(result).includes("AKIAIOSFODNN7EXAMPLE"))
    assert.ok(JSON.stringify(result).includes("[REDACTED_AWS_KEY]"))
  })

  it("redacts nested secret deep inside object", () => {
    const data = {
      meta: {
        config: {
          auth: { token: "Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890" },
        },
      },
    }
    const result = scrubData(data)
    assert.ok(!JSON.stringify(result).includes("ghp_"))
  })

  it("does not alter clean data", () => {
    const data = { cmd: "npm test", score: 3, status: "passing" }
    const result = scrubData(data)
    assert.deepStrictEqual(result, data)
  })

  it("Fix 1: does not swallow trailing JSON syntax when scrubbing password", () => {
    const data = { config: { db_password: "supersecretpassword" } }
    // Should not throw JSON parse error
    let result: typeof data
    assert.doesNotThrow(() => {
      result = scrubData(data)
    })
    // Should still be valid parseable object
    assert.ok(typeof result! === "object")
    assert.ok(!JSON.stringify(result!).includes("supersecretpassword"))
  })

  it("Fix 1: does not crash on JSON with password at end of object", () => {
    const data = { db_password: "mypassword123", other: "value" }
    assert.doesNotThrow(() => scrubData(data))
    const result = scrubData(data)
    assert.ok(!JSON.stringify(result).includes("mypassword123"))
  })

  it("Fix 3: redacts private key with stringified newlines", () => {
    const keyWithNewlines =
      "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA\\n-----END RSA PRIVATE KEY-----"
    const data = { key: keyWithNewlines }
    const result = scrubData(data)
    assert.ok(!JSON.stringify(result).includes("MIIEowIBAAKCAQEA"))
    assert.ok(JSON.stringify(result).includes("[REDACTED_PRIVATE_KEY]"))
  })

  it("Fix 2: hasSensitiveContent works correctly on repeated calls", () => {
    const key = "sk-ant-abcdefghijklmnopqrstuvwxyz123456"
    // Call multiple times — lastIndex reset must work
    assert.strictEqual(hasSensitiveContent(key), true)
    assert.strictEqual(hasSensitiveContent(key), true)
    assert.strictEqual(hasSensitiveContent(key), true)
  })
})

describe("hasSensitiveContent", () => {
  it("returns true for Anthropic key", () => {
    assert.strictEqual(
      hasSensitiveContent("sk-ant-abcdefghijklmnopqrstuvwxyz123456"),
      true
    )
  })

  it("returns false for clean string", () => {
    assert.strictEqual(
      hasSensitiveContent("npm test passed successfully"),
      false
    )
  })
})