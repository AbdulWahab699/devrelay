import { describe, it } from "node:test"
import assert from "node:assert"
import { ApiError, TimeoutError } from "../client.ts"

describe("ApiError", () => {
  it("has correct name and status", () => {
    const err = new ApiError(404, "Not found")
    assert.strictEqual(err.name, "ApiError")
    assert.strictEqual(err.status, 404)
    assert.strictEqual(err.message, "Not found")
  })

  it("is instance of Error", () => {
    const err = new ApiError(500, "Server error")
    assert.ok(err instanceof Error)
    assert.ok(err instanceof ApiError)
  })
})

describe("TimeoutError", () => {
  it("has correct name and message", () => {
    const err = new TimeoutError()
    assert.strictEqual(err.name, "TimeoutError")
    assert.ok(err.message.includes("timed out"))
    assert.ok(err.message.includes("devrelay status"))
  })

  it("is instance of Error", () => {
    const err = new TimeoutError()
    assert.ok(err instanceof Error)
  })
})