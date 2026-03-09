import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  buildIDEProjection,
  GORSEE_AI_CONTEXT_SCHEMA_VERSION,
  resolveAIStorePaths,
  resolveIDEProjectionPaths,
  writeIDEProjection,
} from "../../src/ai/index.ts"

const TMP = join(process.cwd(), ".tmp-ai-ide")

describe("ai ide projection", () => {
  beforeEach(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
  })

  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("builds and writes IDE-friendly projection files", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), [
      JSON.stringify({
        id: "evt-1",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "boom",
        route: "/login",
        file: "routes/login.tsx",
        line: 12,
      }),
      JSON.stringify({
        id: "evt-2",
        kind: "release.check.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "cli",
        message: "tarball validation failed",
        data: {
          version: "0.2.4",
          artifact: "gorsee-0.2.4.tgz",
        },
      }),
    ].join("\n") + "\n")
    await writeFile(join(TMP, ".gorsee", "ai-diagnostics.json"), JSON.stringify({
      latest: {
        code: "E905",
        message: "unsafe redirect",
        severity: "error",
        file: "routes/login.tsx",
        line: 12,
      },
    }))

    const projection = await buildIDEProjection(resolveAIStorePaths(TMP))
    const projectionPaths = resolveIDEProjectionPaths(TMP)
    await writeIDEProjection(projectionPaths, projection)

    const diagnostics = JSON.parse(await readFile(projectionPaths.diagnosticsPath, "utf-8"))
    const events = JSON.parse(await readFile(projectionPaths.eventsPath, "utf-8"))
    const context = await readFile(projectionPaths.contextPath, "utf-8")

    expect(diagnostics.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(diagnostics.diagnostics).toHaveLength(1)
    expect(events.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(events.events).toHaveLength(2)
    expect(events.artifactRegressions).toHaveLength(1)
    expect(events.artifactRegressions[0]?.path).toBe("gorsee-0.2.4.tgz")
    expect(events.events[0]?.artifact ?? events.events[1]?.artifact).toContain(".tgz")
    expect(context).toContain("Gorsee AI Context")
    expect(context).toContain(`Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(context).toContain("## Artifact Regressions")
  })
})
