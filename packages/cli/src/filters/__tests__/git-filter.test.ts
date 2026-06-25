import { describe, it } from "node:test"
import assert from "node:assert"
import { isNoiseFile, isReformatFile, filterGitDiff } from "../git-filter.ts"

describe("isNoiseFile", () => {
  it("marks .env as noise", () => {
    assert.strictEqual(isNoiseFile(".env"), true)
  })
  it("marks .env.local as noise", () => {
    assert.strictEqual(isNoiseFile(".env.local"), true)
  })
  it("marks lockfiles as noise", () => {
    assert.strictEqual(isNoiseFile("pnpm-lock.yaml"), true)
  })
  it("keeps real source files", () => {
    assert.strictEqual(isNoiseFile("src/index.ts"), false)
  })
})

describe("isReformatFile", () => {
  it("detects pure whitespace reformat", () => {
    // Equal counts — realistic Prettier reformat (every line reformatted 1:1)
    const additions = Array(60).fill("+  const x = 1;").join("\n")
    const deletions = Array(60).fill("-  const x=1;").join("\n")
    const diff = additions + "\n" + deletions
    assert.strictEqual(isReformatFile(diff), true)
  })
  it("does NOT flag small diffs as reformat", () => {
    const diff = "+const x = 1\n-const x=1"
    assert.strictEqual(isReformatFile(diff), false)
  })
  it("does NOT flag code rewrite as reformat", () => {
    const additions = Array(60).fill("+  const billingService = new BillingService()").join("\n")
    const deletions = Array(60).fill("-  const legacyModule = new LegacyModule()").join("\n")
    const diff = additions + "\n" + deletions
    assert.strictEqual(isReformatFile(diff), false)
  })
})

describe("filterGitDiff", () => {
  it("returns no changes message for empty diff", () => {
    assert.strictEqual(filterGitDiff(""), "No code changes detected today.")
  })
  it("excludes .env files from output", () => {
    const diff = "diff --git a/.env b/.env\nindex 000..111\n+SECRET=abc123"
    const result = filterGitDiff(diff)
    assert.ok(!result.includes("SECRET=abc123"))
  })
  it("preserves diff --git header on first chunk", () => {
    const diff = "diff --git a/src/index.ts b/src/index.ts\n+const x = 1"
    const result = filterGitDiff(diff)
    assert.ok(result.includes("diff --git"))
  })
  it("truncates at clean line boundary", () => {
    const longLine = "+  const someVariable = " + "a".repeat(100)
    const manyLines = Array(20).fill(longLine).join("\n")
    const diff = "diff --git a/src/index.ts b/src/index.ts\n" + manyLines
    const result = filterGitDiff(diff)
    if (result.includes("... (truncated)")) {
      assert.match(result, /\n\.\.\. \(truncated\)$/)
    }
  })
})