import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import {
  buildAIContextBundle,
  buildIDEProjection,
  GORSEE_AI_CONTEXT_SCHEMA_VERSION,
  renderAIContextMarkdown,
  resolveAIStorePaths,
  resolveIDEProjectionPaths,
  writeAISessionPack,
  writeIDEProjection,
} from "../../src/ai/index.ts"

const REPO_ROOT = resolve(import.meta.dir, "../..")
let tmp = ""

describe("ai schema contract", () => {
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "gorsee-ai-schema-"))
    await mkdir(join(tmp, ".gorsee"), { recursive: true })
    await mkdir(join(tmp, "routes"), { recursive: true })
  })

  afterEach(async () => {
    if (tmp) {
      await rm(tmp, { recursive: true, force: true })
      tmp = ""
    }
  })

  test("keeps schema version aligned across docs, bundle, ide projection, and session pack outputs", async () => {
    await writeFile(join(tmp, "routes", "login.tsx"), "export default function Login() { return <main>login</main> }\n")
    await writeFile(join(tmp, ".gorsee", "ai-events.jsonl"), [
      JSON.stringify({
        id: "evt-1",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "login failed",
        route: "/login",
        file: "routes/login.tsx",
        line: 1,
      }),
      JSON.stringify({
        id: "evt-2",
        kind: "build.summary",
        severity: "warn",
        ts: new Date().toISOString(),
        source: "build",
        message: "bundle emitted with warnings",
        data: {
          artifact: "dist/client/index.js",
          version: "0.2.4",
        },
      }),
    ].join("\n") + "\n")
    await writeFile(join(tmp, ".gorsee", "ai-diagnostics.json"), JSON.stringify({
      latest: {
        code: "E905",
        message: "unsafe redirect",
        severity: "error",
        file: "routes/login.tsx",
        line: 1,
      },
    }))

    const storePaths = resolveAIStorePaths(tmp)
    const bundle = await buildAIContextBundle(tmp, storePaths)
    const projection = await buildIDEProjection(storePaths)
    const projectionPaths = resolveIDEProjectionPaths(tmp)
    await writeIDEProjection(projectionPaths, projection)
    const sessionPack = await writeAISessionPack(tmp, storePaths)

    const diagnosticsProjection = JSON.parse(await readFile(projectionPaths.diagnosticsPath, "utf-8"))
    const eventsProjection = JSON.parse(await readFile(projectionPaths.eventsPath, "utf-8"))
    const contextMarkdown = await readFile(projectionPaths.contextPath, "utf-8")
    const sessionPackJson = JSON.parse(await readFile(sessionPack.paths.latestJsonPath, "utf-8"))
    const sessionPackMarkdown = await readFile(sessionPack.paths.latestMarkdownPath, "utf-8")
    const contractDoc = await readFile(join(REPO_ROOT, "docs", "AI_ARTIFACT_CONTRACT.md"), "utf-8")

    expect(bundle.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(bundle.packet.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(projection.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(projection.context.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(diagnosticsProjection.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(eventsProjection.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(sessionPack.bundle.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(sessionPack.bundle.packet.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(sessionPackJson.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(contextMarkdown).toContain(`Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(renderAIContextMarkdown(bundle.packet)).toContain(`Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(sessionPackMarkdown).toContain(`gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(sessionPackMarkdown).toContain(`Bundle Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(contractDoc).toContain("Current schema:")
    expect(contractDoc).toContain(`- \`${GORSEE_AI_CONTEXT_SCHEMA_VERSION}\``)
    expect(contractDoc).toContain(".gorsee/ide/context.md")
    expect(contractDoc).toContain(".gorsee/agent/latest.json")
    expect(contractDoc).toContain("request.error")
    expect(contractDoc).toContain("build.summary")
    expect(contractDoc).toContain("release.smoke.error")
  })
})
