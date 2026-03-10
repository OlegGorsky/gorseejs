import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  __resetAIObservability,
  configureAIObservability,
  buildAIHealthReport,
  emitAIDiagnostic,
  emitAIEvent,
  GORSEE_AI_CONTEXT_SCHEMA_VERSION,
  resolveAIStorePaths,
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
    configureAIObservability(resolveAIObservabilityConfig(TMP, {
      enabled: true,
      app: {
        mode: "server",
        runtimeTopology: "multi-instance",
      },
    }))

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
    expect(event.app).toEqual({
      mode: "server",
      runtimeTopology: "multi-instance",
    })
    expect(event.data.cookie).toBe("[redacted]")
    expect(event.data.nested.authorization).toBe("[redacted]")
    expect(event.data.safe).toBe("value")
  })

  test("diagnostic events update diagnostics snapshot", async () => {
    configureAIObservability(resolveAIObservabilityConfig(TMP, {
      enabled: true,
      sessionId: "session-1",
      app: {
        mode: "fullstack",
        runtimeTopology: "single-instance",
      },
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
    expect(snapshot.app).toEqual({
      mode: "fullstack",
      runtimeTopology: "single-instance",
    })
    expect(snapshot.latest.code).toBe("E903")
    expect(snapshot.latest.file).toBe("app.config.ts")
    expect(snapshot.latest.line).toBe(4)
    expect(snapshot.latest.app).toEqual({
      mode: "fullstack",
      runtimeTopology: "single-instance",
    })
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
    expect(await readEventually(join(TMP, ".gorsee", "agent", "deploy-summary.json"))).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readEventually(join(TMP, ".gorsee", "agent", "deploy-summary.md"))).toContain("# Gorsee AI Deploy Summary")
    expect(await readEventually(join(TMP, ".gorsee", "agent", "release-brief.json"))).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readEventually(join(TMP, ".gorsee", "agent", "release-brief.md"))).toContain("# Gorsee AI Release Brief")
    expect(await readEventually(join(TMP, ".gorsee", "agent", "incident-brief.json"))).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readEventually(join(TMP, ".gorsee", "agent", "incident-brief.md"))).toContain("# Gorsee AI Incident Brief")
    expect(await readEventually(join(TMP, ".gorsee", "agent", "incident-snapshot.json"))).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readEventually(join(TMP, ".gorsee", "agent", "incident-snapshot.md"))).toContain("# Gorsee AI Incident Snapshot")
  })

  test("health report includes release artifact context when dist/release.json exists", async () => {
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    await mkdir(join(TMP, "dist"), { recursive: true })
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "check.summary",
      severity: "warn",
      ts: new Date().toISOString(),
      source: "check",
      message: "multi-instance drift",
      code: "W921",
      app: {
        mode: "frontend",
        runtimeTopology: "multi-instance",
      },
    })}\n`)
    await writeFile(join(TMP, "dist", "release.json"), JSON.stringify({
      schemaVersion: 1,
      appMode: "frontend",
      generatedAt: "2026-03-10T00:00:00.000Z",
      summary: {
        routeCount: 2,
        clientAssetCount: 3,
        prerenderedCount: 2,
        serverEntryCount: 0,
      },
      runtime: {
        kind: "frontend-static",
        processEntrypoints: [],
        handlerEntrypoints: [],
      },
      artifacts: {
        buildManifest: "manifest.json",
        clientAssets: ["client/a.js"],
        serverEntries: [],
        prerenderedHtml: ["static/index.html"],
      },
    }))

    const report = await buildAIHealthReport(resolveAIStorePaths(TMP))

    expect(report.release).toEqual({
      appMode: "frontend",
      runtimeKind: "frontend-static",
      processEntrypoints: [],
      handlerEntrypoints: [],
      workerEntrypoint: undefined,
      summary: {
        routeCount: 2,
        clientAssetCount: 3,
        prerenderedCount: 2,
        serverEntryCount: 0,
      },
      generatedAt: "2026-03-10T00:00:00.000Z",
    })
    expect(report.readiness.deploy.status).toBe("caution")
    expect(report.readiness.scaling.status).toBe("not-applicable")
  })
})
