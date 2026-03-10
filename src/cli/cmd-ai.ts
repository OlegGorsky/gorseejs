import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"
import {
  buildAIHealthReport,
  buildAIContextBundle,
  buildAIFrameworkPacket,
  buildIDEProjection,
  createIDEProjectionWatcher,
  createAIBridgeServer,
  createAIContextPacket,
  createAIIncidentBrief,
  createAIReleaseBrief,
  createAIMCPServer,
  createLineReader,
  readAIDiagnosticsSnapshot,
  readAIEvents,
  readReactiveTraceArtifact,
  renderAIIncidentBriefMarkdown,
  renderAIContextMarkdown,
  renderAIContextBundleMarkdown,
  renderAIFrameworkMarkdown,
  renderAIReleaseBriefMarkdown,
  resolveAIStorePaths,
  resolveAISessionPackPaths,
  resolveIDEProjectionPaths,
  writeAISessionPack,
  writeIDEProjection,
} from "../ai/index.ts"

export interface AICommandOptions extends RuntimeOptions {}

interface AIFlags {
  limit?: number
  json: boolean
  port?: number
  host?: string
  persistPath?: string
  format?: "json" | "markdown"
  brief?: "release" | "incident"
  bundle: boolean
  watch: boolean
  intervalMs?: number
}

export async function runAI(args: string[], options: AICommandOptions = {}): Promise<void> {
  const subcommand = args[0] ?? "help"
  const flags = parseAIFlags(args.slice(1))
  const { cwd } = createProjectContext(options)
  const paths = resolveAIStorePaths(cwd)

  switch (subcommand) {
    case "framework":
      return runAIFramework(cwd, flags)
    case "tail":
      return runAITail(paths.eventsPath, flags)
    case "doctor":
      return runAIDoctor(paths, flags)
    case "replay":
      return runAIReplay(paths.eventsPath, flags)
    case "export":
      return runAIExport(cwd, paths, flags)
    case "pack":
      return runAIPack(cwd, paths, flags)
    case "ide-sync":
      return runAIIDESync(cwd, paths, flags)
    case "bridge":
      return runAIBridge(paths.eventsPath, flags)
    case "mcp":
      return runAIMCP(paths, flags)
    case "help":
    default:
      printAIHelp()
  }
}

async function runAIFramework(cwd: string, flags: AIFlags): Promise<void> {
  const packet = await buildAIFrameworkPacket(cwd)
  if ((flags.format ?? "json") === "markdown") {
    console.log(renderAIFrameworkMarkdown(packet))
    return
  }

  console.log(JSON.stringify(packet, null, 2))
}

async function runAITail(eventsPath: string, flags: AIFlags): Promise<void> {
  const events = await readAIEvents(eventsPath, { limit: flags.limit ?? 20 })
  if (flags.json) {
    console.log(JSON.stringify(events, null, 2))
    return
  }

  if (events.length === 0) {
    console.log("\n  No AI events found.\n")
    return
  }

  console.log()
  for (const event of events) {
    const loc = [event.route, event.file && event.line ? `${event.file}:${event.line}` : event.file].filter(Boolean).join(" ")
    console.log(`  [${event.severity}] ${event.kind} ${event.message}`)
    console.log(`    ${event.ts}${loc ? `  ${loc}` : ""}`)
  }
  console.log()
}

async function runAIDoctor(paths: ReturnType<typeof resolveAIStorePaths>, flags: AIFlags): Promise<void> {
  const report = await buildAIHealthReport(paths, { limit: flags.limit ?? 200 })
  const reactiveTrace = await readReactiveTraceArtifact(paths.reactiveTracePath)
  if (flags.json) {
    console.log(JSON.stringify({
      ...report,
      reactiveTrace: reactiveTrace
        ? {
            schemaVersion: reactiveTrace.schemaVersion,
            nodes: reactiveTrace.nodes.length,
            edges: reactiveTrace.edges.length,
            events: reactiveTrace.events.length,
            latestEventKind: reactiveTrace.events.at(-1)?.kind,
          }
        : null,
    }, null, 2))
    return
  }

  console.log("\n  Gorsee AI Doctor\n")
  console.log(`  Events: ${report.events.total}`)
  console.log(`  Diagnostics: ${report.diagnostics.total}`)
  console.log(`  Errors: ${report.diagnostics.errors}`)
  console.log(`  Warnings: ${report.diagnostics.warnings}`)
  console.log(`  Deploy readiness: ${report.readiness.deploy.status}`)
  console.log(`  Scaling readiness: ${report.readiness.scaling.status}`)
  if (report.events.latest) {
    console.log(`  Latest event: ${report.events.latest.kind} @ ${report.events.latest.ts}`)
  }
  if (report.release) {
    console.log("\n  Release artifact:")
    console.log(`    - mode=${report.release.appMode} runtime=${report.release.runtimeKind}`)
    console.log(`    - routes=${report.release.summary.routeCount} clientAssets=${report.release.summary.clientAssetCount} prerendered=${report.release.summary.prerenderedCount} serverEntries=${report.release.summary.serverEntryCount}`)
    if (report.release.processEntrypoints.length > 0) {
      console.log(`    - process=${report.release.processEntrypoints.join(", ")}`)
    }
    if (report.release.handlerEntrypoints.length > 0) {
      console.log(`    - handlers=${report.release.handlerEntrypoints.join(", ")}`)
    }
    if (report.release.workerEntrypoint) {
      console.log(`    - worker=${report.release.workerEntrypoint}`)
    }
  }
  if (report.diagnostics.latest?.code) {
    console.log(`  Latest diagnostic: ${report.diagnostics.latest.code} ${report.diagnostics.latest.message ?? ""}`.trim())
  }
  if (report.incidents.length > 0) {
    console.log("\n  Recent incidents:")
    for (const incident of report.incidents.slice(0, 5)) {
      const loc = incident.file ? ` (${incident.file}${incident.line ? `:${incident.line}` : ""})` : incident.route ? ` (${incident.route})` : ""
      console.log(`    - [${incident.kind}] ${incident.message}${loc}`)
    }
  }
  if (report.incidentClusters.length > 0) {
    console.log("\n  Incident clusters:")
    for (const cluster of report.incidentClusters.slice(0, 5)) {
      const loc = cluster.file ? ` (${cluster.file})` : cluster.route ? ` (${cluster.route})` : ""
      console.log(`    - [${cluster.kind}] x${cluster.count}${loc}`)
    }
  }
  if (report.artifactRegressions.length > 0) {
    console.log("\n  Artifact regressions:")
    for (const artifact of report.artifactRegressions.slice(0, 5)) {
      const details = [artifact.version, artifact.path].filter(Boolean).join(" ")
      console.log(`    - [${artifact.phase}] errors=${artifact.errors} warnings=${artifact.warnings} successes=${artifact.successes}${details ? ` (${details})` : ""}`)
    }
  }
  if (report.readiness.deploy.reasons.length > 0 || report.readiness.scaling.reasons.length > 0) {
    console.log("\n  Readiness reasons:")
    for (const reason of report.readiness.deploy.reasons.slice(0, 3)) {
      console.log(`    - deploy: ${reason}`)
    }
    for (const reason of report.readiness.scaling.reasons.slice(0, 3)) {
      console.log(`    - scaling: ${reason}`)
    }
  }
  if (reactiveTrace) {
    console.log("\n  Reactive trace:")
    console.log(`    - schema=${reactiveTrace.schemaVersion} nodes=${reactiveTrace.nodes.length} edges=${reactiveTrace.edges.length} events=${reactiveTrace.events.length}`)
    if (reactiveTrace.events.at(-1)?.kind) {
      console.log(`    - latest=${reactiveTrace.events.at(-1)?.kind}`)
    }
  }
  console.log()
}

async function runAIReplay(eventsPath: string, flags: AIFlags): Promise<void> {
  const events = await readAIEvents(eventsPath, { limit: flags.limit ?? 50 })
  if (events.length === 0) {
    console.log("\n  No AI events found.\n")
    return
  }

  console.log("\n  Gorsee AI Replay\n")
  for (const event of events) {
    const trace = [event.requestId, event.traceId, event.spanId].filter(Boolean).join(" / ")
    const loc = [event.route, event.file && event.line ? `${event.file}:${event.line}` : event.file].filter(Boolean).join(" ")
    const artifact = typeof event.data?.artifact === "string" ? event.data.artifact : undefined
    const version = typeof event.data?.version === "string" ? event.data.version : undefined
    console.log(`  ${event.ts}  [${event.severity}] ${event.kind}`)
    console.log(`    ${event.message}`)
    if (trace) console.log(`    trace: ${trace}`)
    if (loc) console.log(`    loc:   ${loc}`)
    if (version || artifact) console.log(`    data:  ${[version, artifact].filter(Boolean).join("  ")}`)
  }
  console.log()
}

async function runAIExport(cwd: string, paths: ReturnType<typeof resolveAIStorePaths>, flags: AIFlags): Promise<void> {
  if (flags.bundle) {
    const bundle = await buildAIContextBundle(cwd, paths, { limit: flags.limit ?? 200 })
    if ((flags.format ?? "json") === "markdown") {
      console.log(renderAIContextBundleMarkdown(bundle))
      return
    }
    console.log(JSON.stringify(bundle, null, 2))
    return
  }

  const events = await readAIEvents(paths.eventsPath, { limit: flags.limit ?? 200 })
  const diagnostics = await readAIDiagnosticsSnapshot(paths.diagnosticsPath)
  const reactiveTrace = await readReactiveTraceArtifact(paths.reactiveTracePath)
  const report = await buildAIHealthReport(paths, { limit: flags.limit ?? 200 })
  const packet = createAIContextPacket(report, events, diagnostics?.latest, reactiveTrace)

  if (flags.brief === "release") {
    const brief = createAIReleaseBrief(packet)
    if ((flags.format ?? "json") === "markdown") {
      console.log(renderAIReleaseBriefMarkdown(brief))
      return
    }
    console.log(JSON.stringify(brief, null, 2))
    return
  }

  if (flags.brief === "incident") {
    const brief = createAIIncidentBrief(packet)
    if ((flags.format ?? "json") === "markdown") {
      console.log(renderAIIncidentBriefMarkdown(brief))
      return
    }
    console.log(JSON.stringify(brief, null, 2))
    return
  }

  if ((flags.format ?? "json") === "markdown") {
    console.log(renderAIContextMarkdown(packet))
    return
  }

  console.log(JSON.stringify(packet, null, 2))
}

async function runAIPack(cwd: string, paths: ReturnType<typeof resolveAIStorePaths>, flags: AIFlags): Promise<void> {
  const result = await writeAISessionPack(cwd, paths, {
    enabled: true,
    outDir: resolveAISessionPackPaths(cwd).outDir,
    limit: flags.limit ?? 200,
  })

  if (flags.json) {
    console.log(JSON.stringify({
      generatedAt: result.bundle.generatedAt,
      latestJsonPath: result.paths.latestJsonPath,
      latestMarkdownPath: result.paths.latestMarkdownPath,
      latestDeploySummaryJsonPath: result.paths.latestDeploySummaryJsonPath,
      latestDeploySummaryMarkdownPath: result.paths.latestDeploySummaryMarkdownPath,
      latestReleaseBriefJsonPath: result.paths.latestReleaseBriefJsonPath,
      latestReleaseBriefMarkdownPath: result.paths.latestReleaseBriefMarkdownPath,
      latestIncidentBriefJsonPath: result.paths.latestIncidentBriefJsonPath,
      latestIncidentBriefMarkdownPath: result.paths.latestIncidentBriefMarkdownPath,
      latestIncidentSnapshotJsonPath: result.paths.latestIncidentSnapshotJsonPath,
      latestIncidentSnapshotMarkdownPath: result.paths.latestIncidentSnapshotMarkdownPath,
      historyDir: result.paths.historyDir,
      snippets: result.bundle.snippets.length,
    }, null, 2))
    return
  }

  console.log("\n  Gorsee AI Session Pack\n")
  console.log(`  latest json -> ${result.paths.latestJsonPath}`)
  console.log(`  latest md   -> ${result.paths.latestMarkdownPath}`)
  console.log(`  deploy      -> ${result.paths.latestDeploySummaryJsonPath}`)
  console.log(`  deploy md   -> ${result.paths.latestDeploySummaryMarkdownPath}`)
  console.log(`  release     -> ${result.paths.latestReleaseBriefJsonPath}`)
  console.log(`  release md  -> ${result.paths.latestReleaseBriefMarkdownPath}`)
  console.log(`  incident    -> ${result.paths.latestIncidentBriefJsonPath}`)
  console.log(`  incident md -> ${result.paths.latestIncidentBriefMarkdownPath}`)
  console.log(`  snapshot    -> ${result.paths.latestIncidentSnapshotJsonPath}`)
  console.log(`  snapshot md -> ${result.paths.latestIncidentSnapshotMarkdownPath}`)
  console.log(`  history     -> ${result.paths.historyDir}`)
  console.log(`  snippets    -> ${result.bundle.snippets.length}`)
  console.log()
}

async function runAIIDESync(
  cwd: string,
  paths: ReturnType<typeof resolveAIStorePaths>,
  flags: AIFlags,
): Promise<void> {
  const projection = await buildIDEProjection(paths, { limit: flags.limit ?? 100 })
  const projectionPaths = resolveIDEProjectionPaths(cwd)
  await writeIDEProjection(projectionPaths, projection)

  if (flags.watch) {
    const watcher = createIDEProjectionWatcher({
      storePaths: paths,
      projectionPaths,
      limit: flags.limit ?? 100,
      intervalMs: flags.intervalMs ?? 1000,
    })
    watcher.start()
    console.log("\n  Gorsee AI IDE Sync --watch\n")
    console.log(`  diagnostics -> ${projectionPaths.diagnosticsPath}`)
    console.log(`  events      -> ${projectionPaths.eventsPath}`)
    console.log(`  context     -> ${projectionPaths.contextPath}`)
    console.log(`  interval    -> ${flags.intervalMs ?? 1000}ms`)
    console.log()
    await new Promise<void>(() => {})
  }

  if (flags.json) {
    console.log(JSON.stringify({ projectionPaths, diagnostics: projection.diagnostics.length, events: projection.recentEvents.length }, null, 2))
    return
  }

  console.log("\n  Gorsee AI IDE Sync\n")
  console.log(`  diagnostics -> ${projectionPaths.diagnosticsPath}`)
  console.log(`  events      -> ${projectionPaths.eventsPath}`)
  console.log(`  context     -> ${projectionPaths.contextPath}`)
  console.log()
}

async function runAIBridge(eventsPath: string, flags: AIFlags): Promise<void> {
  const bridge = createAIBridgeServer({
    port: flags.port ?? 4318,
    host: flags.host ?? "127.0.0.1",
    persistPath: flags.persistPath ?? eventsPath,
  })
  console.log(`\n  Gorsee AI bridge listening on http://${flags.host ?? "127.0.0.1"}:${bridge.port}/gorsee/ai-events\n`)
  await new Promise<void>(() => {})
}

async function runAIMCP(paths: ReturnType<typeof resolveAIStorePaths>, flags: AIFlags): Promise<void> {
  const server = createAIMCPServer({
    paths,
    limit: flags.limit ?? 50,
  })
  await server.serve(createLineReader(process.stdin), process.stdout)
}

function parseAIFlags(args: string[]): AIFlags {
  const flags: AIFlags = { json: false, bundle: false, watch: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--json") flags.json = true
    if (arg === "--bundle") flags.bundle = true
    if (arg === "--watch") flags.watch = true
    if (arg === "--limit") flags.limit = Number(args[i + 1] ?? "0")
    if (arg === "--interval") flags.intervalMs = Number(args[i + 1] ?? "1000")
    if (arg === "--port") flags.port = Number(args[i + 1] ?? "4318")
    if (arg === "--host") flags.host = args[i + 1]
    if (arg === "--persist") flags.persistPath = args[i + 1]
    if (arg === "--format") {
      const format = args[i + 1]
      if (format === "json" || format === "markdown") flags.format = format
    }
    if (arg === "--brief") {
      const brief = args[i + 1]
      if (brief === "release" || brief === "incident") flags.brief = brief
    }
  }

  return flags
}

function printAIHelp(): void {
  console.log("\n  gorsee ai <subcommand>\n")
  console.log("  Subcommands:")
  console.log("    framework  Export canonical framework context for cold-start agents")
  console.log("    tail       Read recent structured AI events")
  console.log("    doctor     Summarize diagnostics and recent incidents")
  console.log("    replay     Replay correlated AI events in timeline order")
  console.log("    export     Export a compact AI context packet or bundle")
  console.log("               Use --brief release|incident for verdict-oriented summaries")
  console.log("    pack       Write the latest agent-ready session pack to disk")
  console.log("    ide-sync   Write IDE-friendly diagnostics/events/context files")
  console.log("    bridge     Start local HTTP bridge for IDE/agent ingestion")
  console.log("    mcp        Start stdio MCP server over local AI state")
  console.log()
  console.log("  Common flags:")
  console.log("    --json              Render machine-readable output")
  console.log("    --format <fmt>      json | markdown")
  console.log("    --limit <n>         Limit the amount of AI history read")
  console.log("    --bundle            Include ranked code snippets in export output")
  console.log("    --watch             Keep IDE projection files in sync")
  console.log("    --interval <ms>     Watch/poll interval for ide-sync --watch")
  console.log()
}
