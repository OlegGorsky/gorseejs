import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "../../src/ai/index.ts"
import { runAI as runAICommand } from "../../src/cli/cmd-ai.ts"

const TMP = join(process.cwd(), ".tmp-cli-ai")

describe("cmd-ai", () => {
  const originalLog = console.log
  let output: string[] = []

  beforeEach(async () => {
    output = []
    console.log = (...args: unknown[]) => output.push(args.map(String).join(" "))
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
  })

  afterEach(async () => {
    console.log = originalLog
    await rm(TMP, { recursive: true, force: true })
  })

  test("ai doctor summarizes local AI state", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), [
      JSON.stringify({
        id: "evt-1",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "boom",
        requestId: "req-1",
        route: "/login",
      }),
      JSON.stringify({
        id: "evt-2",
        kind: "diagnostic.issue",
        severity: "error",
        ts: new Date().toISOString(),
        source: "check",
        message: "boom",
        code: "E905",
        requestId: "req-1",
        route: "/login",
      }),
      JSON.stringify({
        id: "evt-3",
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
      latest: { code: "E905", message: "unsafe redirect" },
    }))
    await writeFile(join(TMP, ".gorsee", "reactive-trace.json"), JSON.stringify({
      schemaVersion: 1,
      snapshot: {
        signalsCreated: 1,
        signalReads: 1,
        signalWrites: 1,
        computedCreated: 0,
        computedReads: 0,
        computedRuns: 0,
        effectCreated: 0,
        effectRuns: 0,
        resourcesCreated: 0,
        resourceLoadsStarted: 0,
        resourceLoadsSucceeded: 0,
        resourceLoadsFailed: 0,
        resourceInvalidations: 0,
        resourceMutations: 0,
        mutationsCreated: 0,
        mutationRuns: 0,
        mutationSuccesses: 0,
        mutationFailures: 0,
        mutationRollbacks: 0,
        mutationResets: 0
      },
      nodes: [{ id: 1, kind: "signal", reads: 1, writes: 1, runs: 0, invalidations: 0 }],
      edges: [],
      events: [{ seq: 1, kind: "signal:write", nodeId: 1 }]
    }))

    await runAICommand(["doctor"], { cwd: TMP })

    expect(output.join("\n")).toContain("Gorsee AI Doctor")
    expect(output.join("\n")).toContain("Latest diagnostic: E905 unsafe redirect")
    expect(output.join("\n")).toContain("Incident clusters:")
    expect(output.join("\n")).toContain("x2")
    expect(output.join("\n")).toContain("Artifact regressions:")
    expect(output.join("\n")).toContain("gorsee-0.2.4.tgz")
    expect(output.join("\n")).toContain("Reactive trace:")
    expect(output.join("\n")).toContain("nodes=1")
  })

  test("ai tail renders recent events", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "build.summary",
      severity: "info",
      ts: new Date().toISOString(),
      source: "build",
      message: "build completed",
    })}\n`)

    await runAICommand(["tail", "--limit", "5"], { cwd: TMP })

    expect(output.join("\n")).toContain("build.summary")
    expect(output.join("\n")).toContain("build completed")
  })

  test("ai replay includes artifact metadata for release events", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "release.extension.finish",
      severity: "info",
      ts: new Date().toISOString(),
      source: "cli",
      message: "VSIX built",
      data: {
        version: "0.2.4",
        artifact: "dist/vscode-gorsee-ai/gorsee-ai-tools-0.2.4.vsix",
      },
    })}\n`)

    await runAICommand(["replay"], { cwd: TMP })

    expect(output.join("\n")).toContain("release.extension.finish")
    expect(output.join("\n")).toContain("gorsee-ai-tools-0.2.4.vsix")
  })

  test("ai export renders markdown context packet", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "request.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "runtime",
      message: "boom",
      route: "/login",
    })}\n`)
    await writeFile(join(TMP, ".gorsee", "reactive-trace.json"), JSON.stringify({
      schemaVersion: 1,
      snapshot: {
        signalsCreated: 0,
        signalReads: 0,
        signalWrites: 0,
        computedCreated: 0,
        computedReads: 0,
        computedRuns: 0,
        effectCreated: 0,
        effectRuns: 0,
        resourcesCreated: 0,
        resourceLoadsStarted: 0,
        resourceLoadsSucceeded: 0,
        resourceLoadsFailed: 0,
        resourceInvalidations: 0,
        resourceMutations: 0,
        mutationsCreated: 0,
        mutationRuns: 0,
        mutationSuccesses: 0,
        mutationFailures: 0,
        mutationRollbacks: 0,
        mutationResets: 0
      },
      nodes: [],
      edges: [],
      events: [{ seq: 1, kind: "resource:load.start", nodeId: 1 }]
    }))

    await runAICommand(["export", "--format", "markdown"], { cwd: TMP })

    expect(output.join("\n")).toContain("# Gorsee AI Context")
    expect(output.join("\n")).toContain(`Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(output.join("\n")).toContain("## Summary")
    expect(output.join("\n")).toContain("## Reactive Trace")
  })

  test("ai export --bundle renders ranked snippets", async () => {
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "routes", "login.tsx"), [
      "export default function Login() {",
      "  const unsafe = redirectTarget",
      "  return <div>{unsafe}</div>",
      "}",
    ].join("\n"))
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "request.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "runtime",
      message: "boom",
      file: "routes/login.tsx",
      line: 2,
      route: "/login",
    })}\n`)
    await writeFile(join(TMP, ".gorsee", "ai-diagnostics.json"), JSON.stringify({
      latest: { code: "E905", message: "unsafe redirect", severity: "error", file: "routes/login.tsx", line: 2, route: "/login" },
    }))

    await runAICommand(["export", "--bundle", "--format", "markdown"], { cwd: TMP })

    expect(output.join("\n")).toContain(`Bundle Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(output.join("\n")).toContain("## Snippets")
    expect(output.join("\n")).toContain("redirectTarget")
  })

  test("ai ide-sync writes projection files", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "build.summary",
      severity: "info",
      ts: new Date().toISOString(),
      source: "build",
      message: "build completed",
    })}\n`)

    await runAICommand(["ide-sync"], { cwd: TMP })

    expect(output.join("\n")).toContain("Gorsee AI IDE Sync")
    expect(output.join("\n")).toContain(".gorsee/ide/diagnostics.json")
  })

  test("ai pack writes session pack artifacts", async () => {
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "routes", "login.tsx"), "export default function Login() { return <div>login</div> }\n")
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "request.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "runtime",
      message: "boom",
      file: "routes/login.tsx",
      line: 1,
    })}\n`)

    await runAICommand(["pack"], { cwd: TMP })

    expect(output.join("\n")).toContain("Gorsee AI Session Pack")
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.json"), "utf-8")).toContain("request.error")
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.json"), "utf-8")).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.md"), "utf-8")).toContain(`gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.md"), "utf-8")).toContain("# Gorsee AI Context")
  })
})
