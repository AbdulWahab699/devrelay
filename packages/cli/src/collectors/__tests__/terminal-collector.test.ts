import { describe, it } from "node:test";
import assert from "node:assert";
import { detectShell, getHistoryPath, joinZshMultilineCommands } from "../terminal-collector.ts";

describe("detectShell", () => {
  it("returns a valid shell type", () => {
    const result = detectShell();
    assert.ok(["zsh", "bash", "unknown"].includes(result));
  });
});

describe("getHistoryPath", () => {
  it("returns zsh history path for zsh", () => {
    const path = getHistoryPath("zsh");
    assert.ok(path.includes(".zsh_history"));
  });
  it("returns bash history path for bash", () => {
    const path = getHistoryPath("bash");
    assert.ok(path.includes(".bash_history"));
  });
  it("returns PowerShell history path for unknown", () => {
    const path = getHistoryPath("unknown");
    assert.ok(path.includes("ConsoleHost_history.txt"));
  });
});

describe("joinZshMultilineCommands", () => {
  it("joins continuation lines into one command", () => {
    const lines = [
      ": 1719045300:0;for file in *.ts; do \\",
      "  echo checking \\",
      "done",
    ];
    const result = joinZshMultilineCommands(lines);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].includes("for file in *.ts; do"));
    assert.ok(result[0].includes("done"));
  });

  it("does not merge non-continuation lines", () => {
    const lines = [
      ": 1719045300:0;npm test",
      ": 1719045301:0;git status",
    ];
    const result = joinZshMultilineCommands(lines);
    assert.strictEqual(result.length, 2);
  });

  it("handles boundary cut scenario — partial multiline at start", () => {
    // Simulates lines 2,3 of a multiline that was cut at boundary
    // These dont start with : so they get treated as plain commands
    // After join+slice fix this wont happen — but if it does, no crash
    const lines = [
      "  echo checking \\",
      "done",
    ];
    const result = joinZshMultilineCommands(lines);
    // Should join them without crashing
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].includes("done"));
  });
});
