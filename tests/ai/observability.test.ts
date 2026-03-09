import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import {
  __resetAIObservability,
  configureAIObservability,
  emitAIDiagnostic,
  emitAIEvent,
  GORSEE_AI_CONTEXT_SCHEMA_VERSION,
  resolveAIObservabilityConfig,
} from "../../src/ai/index.ts"

const TMP = join(process.cwd(), ".tmp-ai-observability")

async function readEventually(path: string, attempts = 20): Promise<string> {
  for (let index = 0; index < attempts; index++) {
    try {
      const content = await readFile(path, "utf-8")
      if (content.length > 0) return content
    } catch {
      // wait for session-pack write
    }
    await Bun.sleep(10)
  }
  return readFile(path, "utf-8")
}

describe("ai observability", () => {
  beforeEach(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    __resetAIObservability()
  })

  afterEach(async () => {
    __resetAIObservability()
    await rm(TMP, { recursive: true, force: true })
  })

  test("disabled config does not write events", async () => {
    configureAIObservability(resolveAIObservabilityConfig(TMP, { enabled: false }))

    await emitAIEvent({
      kind: "request.start",
      severity: "info",
      source: "runtime",
      message: "should be ignored",
    })

    await expect(readFile(join(TMP, ".gorsee", "ai-events.jsonl"), "utf-8")).rejects.toThrow()
  })

  test("writes redacted JSONL events", async () => {
    configureAIObservability(resolveAIObservabilityConfig(TMP, { enabled: true }))

    await emitAIEvent({
      kind: "request.error",
      severity: "error",
      source: "runtime",
      message: "request failed",
      data: {
        cookie: "secret-cookie",
        nested: { authorization: "Bearer 123" },
        safe: "value",
      },
    })

    const content = await readFile(join(TMP, ".gorsee", "ai-events.jsonl"), "utf-8")
    const event = JSON.parse(content.trim())
    expect(event.data.cookie).toBe("[redacted]")
    expect(event.data.nested.authorization).toBe("[redacted]")
    expect(event.data.safe).toBe("value")
  })

  test("diagnostic events update diagnostics snapshot", async () => {
    configureAIObservability(resolveAIObservabilityConfig(TMP, {
      enabled: true,
      sessionId: "session-1",
    }))

    await emitAIDiagnostic({
      code: "E903",
      message: "RPC policy missing",
      severity: "error",
      source: "check",
      file: "app.config.ts",
      line: 4,
      fix: "Add security.rpc.middlewares",
    })

    const snapshot = JSON.parse(await readFile(join(TMP, ".gorsee", "ai-diagnostics.json"), "utf-8"))
    expect(snapshot.sessionId).toBe("session-1")
    expect(snapshot.latest.code).toBe("E903")
    expect(snapshot.latest.file).toBe("app.config.ts")
    expect(snapshot.latest.line).toBe(4)
  })

  test("relative AI paths resolve against project cwd", async () => {
    const config = resolveAIObservabilityConfig(TMP, {
      enabled: true,
      jsonlPath: ".gorsee/custom-events.jsonl",
      diagnosticsPath: ".gorsee/custom-diagnostics.json",
      sessionPack: {
        enabled: true,
        outDir: ".gorsee/custom-agent",
      },
    })

    expect(config.jsonlPath).toBe(join(TMP, ".gorsee", "custom-events.jsonl"))
    expect(config.diagnosticsPath).toBe(join(TMP, ".gorsee", "custom-diagnostics.json"))
    expect(config.sessionPack?.outDir).toBe(join(TMP, ".gorsee", "custom-agent"))
  })

  test("error events can auto-write session packs", async () => {
    await mkdir(join(TMP, "routes"), { recursive: true })
    await Bun.write(join(TMP, "routes", "login.tsx"), "export default function Login() { return <div>login</div> }\n")
    configureAIObservability(resolveAIObservabilityConfig(TMP, {
      enabled: true,
      sessionPack: {
        enabled: true,
        debounceMs: 5,
      },
    }))

    await emitAIEvent({
      kind: "request.error",
      severity: "error",
      source: "runtime",
      message: "request failed",
      file: "routes/login.tsx",
      line: 1,
      route: "/login",
    })
    expect(await readEventually(join(TMP, ".gorsee", "agent", "latest.json"))).toContain("request.error")
    expect(await readEventually(join(TMP, ".gorsee", "agent", "latest.json"))).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readEventually(join(TMP, ".gorsee", "agent", "latest.md"))).toContain(`gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(await readEventually(join(TMP, ".gorsee", "agent", "latest.md"))).toContain("# Gorsee AI Context")
  })
})
