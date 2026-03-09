import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { readAIDiagnosticsSnapshot, readAIEvents } from "../../src/ai/index.ts"

const TMP = join(process.cwd(), ".tmp-ai-store")

describe("ai store readers", () => {
  test("readAIEvents skips malformed and oversized lines", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    const oversized = JSON.stringify({
      id: "evt-oversized",
      kind: "request.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "runtime",
      message: "x".repeat(80_000),
    })
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), [
      "{not valid json}",
      oversized,
      JSON.stringify({
        id: "evt-valid",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "ok",
      }),
    ].join("\n"))

    const events = await readAIEvents(join(TMP, ".gorsee", "ai-events.jsonl"))

    expect(events).toHaveLength(1)
    expect(events[0]?.id).toBe("evt-valid")
  })

  test("readAIDiagnosticsSnapshot returns null for malformed snapshot JSON", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    await writeFile(join(TMP, ".gorsee", "ai-diagnostics.json"), "{broken")

    const snapshot = await readAIDiagnosticsSnapshot(join(TMP, ".gorsee", "ai-diagnostics.json"))

    expect(snapshot).toBeNull()
  })
})
