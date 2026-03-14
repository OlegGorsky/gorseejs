import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "../../src/ai/index.ts"
import { runAI as runAICommand } from "../../src/cli/cmd-ai.ts"

const TMP = join(process.cwd(), ".tmp-cli-ai")
const ROOT_PACKAGE = JSON.parse(await Bun.file(join(process.cwd(), "package.json")).text()) as {
  version: string
}
const RELEASE_TARBALL = `gorsee-${ROOT_PACKAGE.version}.tgz`
const VSCODE_VSIX = `dist/vscode-gorsee-ai/gorsee-ai-tools-${ROOT_PACKAGE.version}.vsix`

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
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Doctor Rules\n\nInspect before apply.\n")
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
          version: ROOT_PACKAGE.version,
          artifact: RELEASE_TARBALL,
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
    await mkdir(join(TMP, "dist"), { recursive: true })
    await writeFile(join(TMP, "dist", "release.json"), JSON.stringify({
      schemaVersion: 1,
      appMode: "server",
      generatedAt: "2026-03-10T00:00:00.000Z",
      summary: {
        routeCount: 1,
        clientAssetCount: 0,
        prerenderedCount: 0,
        serverEntryCount: 5,
      },
      runtime: {
        kind: "server-runtime",
        processEntrypoints: ["prod.js", "prod-node.js"],
        handlerEntrypoints: ["server-handler.js", "server-handler-node.js"],
        workerEntrypoint: "worker.js",
      },
      artifacts: {
        buildManifest: "manifest.json",
        clientAssets: [],
        serverEntries: ["prod.js", "prod-node.js", "server-handler.js", "server-handler-node.js", "worker.js"],
        prerenderedHtml: [],
      },
    }))

    await runAICommand(["doctor"], { cwd: TMP })

    expect(output.join("\n")).toContain("Gorsee AI Doctor")
    expect(output.join("\n")).toContain("AI mode: inspect")
    expect(output.join("\n")).toContain("Rules: .gorsee/rules.md")
    expect(output.join("\n")).toContain("Latest diagnostic: E905 unsafe redirect")
    expect(output.join("\n")).toContain("Deploy readiness: blocked")
    expect(output.join("\n")).toContain("Scaling readiness: not-applicable")
    expect(output.join("\n")).toContain("Incident clusters:")
    expect(output.join("\n")).toContain("x2")
    expect(output.join("\n")).toContain("Artifact regressions:")
    expect(output.join("\n")).toContain(RELEASE_TARBALL)
    expect(output.join("\n")).toContain("Release artifact:")
    expect(output.join("\n")).toContain("mode=server runtime=server-runtime")
    expect(output.join("\n")).toContain("worker=worker.js")
    expect(output.join("\n")).toContain("Readiness reasons:")
    expect(output.join("\n")).toContain("Reactive trace:")
    expect(output.join("\n")).toContain("nodes=1")
  })

  test("ai framework exports canonical cold-start packet", async () => {
    await writeFile(join(TMP, "AGENTS.md"), "# local contract\n")
    await writeFile(join(TMP, "README.md"), "# app\n")
    await mkdir(join(TMP, "docs"), { recursive: true })
    await writeFile(join(TMP, "docs", "PRODUCT_SURFACE_AUDIT.md"), "# Surface Audit\n")
    await writeFile(join(TMP, "app.config.ts"), `export default { app: { mode: "server" } }\n`)
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# AI Rules\n\nPrefer inspect before apply.\n")

    await runAICommand(["framework"], { cwd: TMP })

    const packet = JSON.parse(output.join("\n")) as {
      kind: string
      appMode: string
      product: { name: string }
      entrypoints: { browser: string; server: string }
      cli: {
        topLevelCommands: Array<{ command: string; stability: string; purpose: string }>
        aiSubcommands: Array<{ command: string; stability: string; purpose: string }>
      }
      docs: { local: Array<{ path: string }>; canonical: Array<{ path: string }> }
      routeGrammar: string[]
      aiCommands: Array<{ command: string }>
      operationModes: Array<{ mode: string }>
      transport: { modelTraffic: string }
      rules?: { path: string; content: string }
      frameworkReferenceMarkdown: string
    }

    expect(packet.kind).toBe("gorsee.framework")
    expect(packet.appMode).toBe("server")
    expect(packet.product.name).toBe("Gorsee")
    expect(packet.entrypoints.browser).toBe("gorsee/client")
    expect(packet.entrypoints.server).toBe("gorsee/server")
    expect(packet.docs.local.map((entry) => entry.path)).toContain("AGENTS.md")
    expect(packet.docs.canonical.map((entry) => entry.path)).toContain("docs/PRODUCT_SURFACE_AUDIT.md")
    expect(packet.routeGrammar).toContain("load -> route data reads")
    expect(packet.cli.topLevelCommands.map((entry) => entry.command)).toContain("test")
    expect(packet.cli.topLevelCommands.map((entry) => entry.command)).toContain("upgrade")
    expect(packet.cli.topLevelCommands.find((entry) => entry.command === "worker")?.stability).toBe("stable")
    expect(packet.cli.aiSubcommands.map((entry) => entry.command)).toContain("init")
    expect(packet.cli.aiSubcommands.map((entry) => entry.command)).toContain("checkpoint")
    expect(packet.aiCommands.map((entry) => entry.command)).toContain("gorsee ai init")
    expect(packet.aiCommands.map((entry) => entry.command)).toContain("gorsee ai framework --format markdown")
    expect(packet.aiCommands.map((entry) => entry.command)).toContain("gorsee ai checkpoint --mode inspect")
    expect(packet.operationModes.map((entry) => entry.mode)).toEqual(["inspect", "propose", "apply", "operate"])
    expect(packet.transport.modelTraffic).toBe("provider-direct-or-self-hosted")
    expect(packet.rules?.path).toBe(".gorsee/rules.md")
    expect(packet.rules?.content).toContain("Prefer inspect before apply.")
    expect(packet.frameworkReferenceMarkdown).toContain("Gorsee is an AI-first application platform")
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
        version: ROOT_PACKAGE.version,
        artifact: VSCODE_VSIX,
      },
    })}\n`)

    await runAICommand(["replay"], { cwd: TMP })

    expect(output.join("\n")).toContain("release.extension.finish")
    expect(output.join("\n")).toContain(VSCODE_VSIX)
  })

  test("ai export renders markdown context packet", async () => {
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Export Rules\n\nUse inspect mode by default.\n")
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
    await mkdir(join(TMP, "dist"), { recursive: true })
    await writeFile(join(TMP, "dist", "release.json"), JSON.stringify({
      schemaVersion: 1,
      appMode: "frontend",
      generatedAt: "2026-03-10T00:00:00.000Z",
      summary: {
        routeCount: 1,
        clientAssetCount: 2,
        prerenderedCount: 1,
        serverEntryCount: 0,
      },
      runtime: {
        kind: "frontend-static",
        processEntrypoints: [],
        handlerEntrypoints: [],
      },
      artifacts: {
        buildManifest: "manifest.json",
        clientAssets: ["client/home.js"],
        serverEntries: [],
        prerenderedHtml: ["static/index.html"],
      },
    }))

    await runAICommand(["export", "--format", "markdown"], { cwd: TMP })

    expect(output.join("\n")).toContain("# Gorsee AI Context")
    expect(output.join("\n")).toContain(`Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(output.join("\n")).toContain("## AI Agent")
    expect(output.join("\n")).toContain("## AI Rules")
    expect(output.join("\n")).toContain("## Summary")
    expect(output.join("\n")).toContain("## Release Artifact")
    expect(output.join("\n")).toContain("## Readiness")
    expect(output.join("\n")).toContain("Deploy: blocked")
    expect(output.join("\n")).toContain("Runtime: frontend-static")
    expect(output.join("\n")).toContain("## Reactive Trace")
  })

  test("ai export can emit release brief", async () => {
    await mkdir(join(TMP, "dist"), { recursive: true })
    await writeFile(join(TMP, "dist", "release.json"), JSON.stringify({
      schemaVersion: 1,
      appMode: "server",
      generatedAt: "2026-03-10T00:00:00.000Z",
      summary: {
        routeCount: 1,
        clientAssetCount: 0,
        prerenderedCount: 0,
        serverEntryCount: 5,
      },
      runtime: {
        kind: "server-runtime",
        processEntrypoints: ["prod.js", "prod-node.js"],
        handlerEntrypoints: ["server-handler.js", "server-handler-node.js"],
        workerEntrypoint: "worker.js",
      },
      artifacts: {
        buildManifest: "manifest.json",
        clientAssets: [],
        serverEntries: ["prod.js", "prod-node.js", "server-handler.js", "server-handler-node.js", "worker.js"],
        prerenderedHtml: [],
      },
    }))
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "release.check.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "cli",
      message: "release blocked",
      data: {
        artifact: "gorsee.tgz",
      },
    })}\n`)

    await runAICommand(["export", "--brief", "release", "--format", "markdown"], { cwd: TMP })

    expect(output.join("\n")).toContain("# Gorsee AI Release Brief")
    expect(output.join("\n")).toContain("Verdict: hold")
    expect(output.join("\n")).toContain("## Blockers")
  })

  test("ai export can emit incident brief", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "request.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "runtime",
      message: "boom",
      route: "/ops",
      requestId: "req-1",
    })}\n`)

    await runAICommand(["export", "--brief", "incident", "--format", "markdown"], { cwd: TMP })

    expect(output.join("\n")).toContain("# Gorsee AI Incident Brief")
    expect(output.join("\n")).toContain("Severity:")
    expect(output.join("\n")).toContain("## Incidents")
  })

  test("ai framework renders markdown packet", async () => {
    await writeFile(join(TMP, "FRAMEWORK.md"), "# Custom Framework\n\nLocal packet.\n")
    await writeFile(join(TMP, "app.config.ts"), `export default { app: { mode: "frontend" } }\n`)
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Rules\n\nRead-only first.\n")

    await runAICommand(["framework", "--format", "markdown"], { cwd: TMP })

    expect(output.join("\n")).toContain("# Gorsee AI Framework Packet")
    expect(output.join("\n")).toContain("App Mode: frontend")
    expect(output.join("\n")).toContain("## Canonical Entrypoints")
    expect(output.join("\n")).toContain("`gorsee/client`")
    expect(output.join("\n")).toContain("`gorsee ai init`")
    expect(output.join("\n")).toContain("docs/PRODUCT_SURFACE_AUDIT.md")
    expect(output.join("\n")).toContain("## CLI Commands")
    expect(output.join("\n")).toContain("`test` [stable]")
    expect(output.join("\n")).toContain("## CLI AI Subcommands")
    expect(output.join("\n")).toContain("`checkpoint` [stable]")
    expect(output.join("\n")).toContain("## AI Operation Modes")
    expect(output.join("\n")).toContain("## AI Transport Contract")
    expect(output.join("\n")).toContain("## AI Rules")
    expect(output.join("\n")).toContain("Source: `FRAMEWORK.md`")
    expect(output.join("\n")).toContain("Local packet.")
  })

  test("ai init scaffolds local AI files", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { app: { mode: "server" }, ai: { enabled: true } }\n`)

    await runAICommand(["init"], { cwd: TMP })

    expect(output.join("\n")).toContain("Gorsee AI Init")
    expect(output.join("\n")).toContain("project     -> .tmp-cli-ai")
    expect(output.join("\n")).toContain("app mode    -> server")
    expect(await readFile(join(TMP, ".gorsee", "rules.md"), "utf-8")).toContain("Project: .tmp-cli-ai")
    expect(await readFile(join(TMP, ".gorsee", "rules.md"), "utf-8")).toContain("App Mode: server")
    expect(await readFile(join(TMP, "GORSEE.md"), "utf-8")).toContain("## Recommended Workflow")
    await expect(access(join(TMP, ".gorsee", "agent", "checkpoints"))).resolves.toBeNull()
  })

  test("ai init does not overwrite existing scaffold without --force", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { app: { mode: "frontend" }, ai: { enabled: true } }\n`)
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Custom Rules\n\nKeep this.\n")
    await writeFile(join(TMP, "GORSEE.md"), "# Custom Guide\n\nKeep this too.\n")

    await runAICommand(["init"], { cwd: TMP })

    expect(output.join("\n")).toContain("kept       -> .gorsee/rules.md")
    expect(output.join("\n")).toContain("kept       -> GORSEE.md")
    expect(await readFile(join(TMP, ".gorsee", "rules.md"), "utf-8")).toContain("Keep this.")
    expect(await readFile(join(TMP, "GORSEE.md"), "utf-8")).toContain("Keep this too.")
  })

  test("ai init overwrites existing scaffold with --force", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { app: { mode: "fullstack" }, ai: { enabled: true } }\n`)
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Old Rules\n")
    await writeFile(join(TMP, "GORSEE.md"), "# Old Guide\n")

    await runAICommand(["init", "--force"], { cwd: TMP })

    expect(output.join("\n")).toContain("updated    -> .gorsee/rules.md")
    expect(output.join("\n")).toContain("updated    -> GORSEE.md")
    expect(await readFile(join(TMP, ".gorsee", "rules.md"), "utf-8")).toContain("App Mode: fullstack")
    expect(await readFile(join(TMP, "GORSEE.md"), "utf-8")).toContain("Project: .tmp-cli-ai")
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
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Sync Rules\n\nInspect only.\n")
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
    expect(await readFile(join(TMP, ".gorsee", "ide", "diagnostics.json"), "utf-8")).toContain('"currentMode": "inspect"')
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
    expect(output.join("\n")).toContain("deploy      ->")
    expect(output.join("\n")).toContain("release     ->")
    expect(output.join("\n")).toContain("incident    ->")
    expect(output.join("\n")).toContain("snapshot    ->")
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.json"), "utf-8")).toContain("request.error")
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.json"), "utf-8")).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.md"), "utf-8")).toContain(`gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.md"), "utf-8")).toContain("# Gorsee AI Context")
    expect(await readFile(join(TMP, ".gorsee", "agent", "deploy-summary.json"), "utf-8")).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "deploy-summary.md"), "utf-8")).toContain("# Gorsee AI Deploy Summary")
    expect(await readFile(join(TMP, ".gorsee", "agent", "release-brief.json"), "utf-8")).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "release-brief.md"), "utf-8")).toContain("# Gorsee AI Release Brief")
    expect(await readFile(join(TMP, ".gorsee", "agent", "incident-brief.json"), "utf-8")).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "incident-brief.md"), "utf-8")).toContain("# Gorsee AI Incident Brief")
    expect(await readFile(join(TMP, ".gorsee", "agent", "incident-snapshot.json"), "utf-8")).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "incident-snapshot.md"), "utf-8")).toContain("# Gorsee AI Incident Snapshot")
  })

  test("ai checkpoint writes explicit checkpoint artifacts", async () => {
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "routes", "ops.tsx"), "export default function Ops() { return <main>ops</main> }\n")
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "request.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "runtime",
      message: "ops failed",
      file: "routes/ops.tsx",
      line: 1,
    })}\n`)
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Agent Rules\n\nCheckpoint before operate.\n")

    await runAICommand(["checkpoint", "--mode", "operate", "--name", "Ops Triage"], { cwd: TMP })

    expect(output.join("\n")).toContain("Gorsee AI Checkpoint")
    expect(output.join("\n")).toContain("mode        -> operate")
    expect(await readFile(join(TMP, ".gorsee", "agent", "checkpoints", "ops-triage.json"), "utf-8")).toContain(`"schemaVersion": "${GORSEE_AI_CONTEXT_SCHEMA_VERSION}"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "checkpoints", "ops-triage.md"), "utf-8")).toContain("gorsee-ai-mode: operate")
    expect(await readFile(join(TMP, ".gorsee", "agent", "checkpoints", "ops-triage.meta.json"), "utf-8")).toContain(`"rulesPath": ".gorsee/rules.md"`)
    expect(await readFile(join(TMP, ".gorsee", "agent", "checkpoints", "latest.json"), "utf-8")).toContain(`"mode": "operate"`)
  })
})
