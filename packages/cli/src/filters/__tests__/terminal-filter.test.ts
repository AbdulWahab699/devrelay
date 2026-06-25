import { describe, it } from "node:test"
import assert from "node:assert"
import { filterTerminalCommands, collapseRepetitions } from "../terminal-filter.ts"

describe("filterTerminalCommands", () => {
  it("removes noise commands", () => {
    const raw = [
      { cmd: "ls -la" },
      { cmd: "cd src" },
      { cmd: "npm test" },
      { cmd: "clear" },
    ]
    const result = filterTerminalCommands(raw)
    const cmds = result.map((r) => r.cmd)
    assert.ok(!cmds.some((c) => c === "ls -la"))
    assert.ok(!cmds.some((c) => c === "cd src"))
    assert.ok(!cmds.some((c) => c === "clear"))
    assert.ok(cmds.some((c) => c.includes("npm test")))
  })

  it("Fix 2: does NOT flag git commit with echo in message as noise", () => {
    const raw = [{ cmd: "git commit -m fix echo routing" }]
    const result = filterTerminalCommands(raw)
    assert.strictEqual(result.length, 1)
    assert.ok(result[0].cmd.includes("git commit"))
  })

  it("Fix 2: does NOT flag docker-helper file creation as noise", () => {
    const raw = [{ cmd: "touch src/services/docker-helper.ts" }]
    const result = filterTerminalCommands(raw)
    assert.strictEqual(result.length, 1)
  })

  it("Fix 3: preserves chronological order", () => {
    const raw = [
      { cmd: "npx prisma migrate dev" },
      { cmd: "npm test" },
      { cmd: "git checkout -b deploy/v1" },
    ]
    const result = filterTerminalCommands(raw)
    const cmds = result.map((r) => r.cmd)
    const prismaIdx = cmds.findIndex((c) => c.includes("prisma"))
    const testIdx = cmds.findIndex((c) => c.includes("npm test"))
    const checkoutIdx = cmds.findIndex((c) => c.includes("checkout"))
    assert.ok(prismaIdx < testIdx)
    assert.ok(testIdx < checkoutIdx)
  })

  it("caps result at 30 commands", () => {
    const raw = Array(50).fill(null).map((_, i) => ({
      cmd: `npm install package-${i}`
    }))
    const result = filterTerminalCommands(raw)
    assert.ok(result.length <= 30)
  })

  it("marks exit_codes_unavailable as true", () => {
    const raw = [{ cmd: "npm test" }]
    const result = filterTerminalCommands(raw)
    assert.strictEqual(result[0].exit_codes_unavailable, true)
  })
})

describe("collapseRepetitions", () => {
  it("Fix 1: correctly increments counter beyond x2", () => {
    const raw = [
      { cmd: "npm test" },
      { cmd: "npm test" },
      { cmd: "npm test" },
      { cmd: "npm test" },
    ]
    const result = collapseRepetitions(raw)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].cmd, "npm test x4")
  })

  it("Fix 1: does not reset counter mid-sequence", () => {
    const raw = [
      { cmd: "npm test" },
      { cmd: "npm test" },
      { cmd: "npm test" },
    ]
    const result = collapseRepetitions(raw)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].cmd, "npm test x3")
  })

  it("does not collapse non-consecutive commands", () => {
    const raw = [
      { cmd: "npm test" },
      { cmd: "git status" },
      { cmd: "npm test" },
    ]
    const result = collapseRepetitions(raw)
    assert.strictEqual(result.length, 3)
  })
})