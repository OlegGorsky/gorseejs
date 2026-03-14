import type { AIDiagnostic, AIEvent } from "./index.ts"
import type { AIHealthReport } from "./store.ts"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "./contracts.ts"
import type { ReactiveTraceArtifact } from "../reactive/diagnostics.ts"
import {
  AI_OPERATION_MODES,
  AI_TRANSPORT_CONTRACT,
  type AIOperationMode,
  type AIRulesFile,
} from "./rules.ts"

export interface AIContextPacket {
  schemaVersion: string
  generatedAt: string
  agent: {
    currentMode: AIOperationMode
    availableModes: Array<{
      mode: AIOperationMode
      purpose: string
      mutatesFiles: boolean
      mutatesRuntime: boolean
    }>
    transport: {
      modelTraffic: string
      bridgeRole: string
      productionRole: string
    }
    rules?: {
      path: string
      content: string
    }
  }
  app?: {
    mode: "frontend" | "fullstack" | "server"
    runtimeTopology: "single-instance" | "multi-instance"
  }
  summary: {
    headline: string
    events: number
    errors: number
    warnings: number
  }
  readiness: {
    deploy: {
      status: "ready" | "caution" | "blocked"
      reasons: string[]
    }
    scaling: {
      status: "ready" | "caution" | "blocked" | "not-applicable"
      reasons: string[]
    }
  }
  release?: {
    appMode: "frontend" | "fullstack" | "server"
    runtimeKind: "frontend-static" | "fullstack-runtime" | "server-runtime"
    processEntrypoints: string[]
    handlerEntrypoints: string[]
    workerEntrypoint?: string
    routeCount: number
    clientAssetCount: number
    prerenderedCount: number
    serverEntryCount: number
    generatedAt: string
  }
  latestDiagnostic?: Partial<AIDiagnostic>
  recentIncidents: Array<{
    ts: string
    kind: string
    message: string
    route?: string
    file?: string
    line?: number
    code?: string
  }>
  incidentClusters: Array<{
    key: string
    count: number
    kind: string
    route?: string
    file?: string
    latestTs: string
  }>
  artifactRegressions: Array<{
    key: string
    phase: string
    path?: string
    version?: string
    errors: number
    warnings: number
    successes: number
    latestTs: string
    latestStatus: "error" | "warn" | "success" | "info"
  }>
  hotspots: Array<{
    key: string
    count: number
    kind: "route" | "file" | "event"
  }>
  reactiveTrace?: {
    schemaVersion: number
    nodes: number
    edges: number
    events: number
    latestEventKind?: string
  }
  recommendations: string[]
}

export interface AIReleaseBrief {
  schemaVersion: string
  generatedAt: string
  app?: AIContextPacket["app"]
  release?: AIContextPacket["release"]
  readiness: AIContextPacket["readiness"]
  verdict: "ship" | "review" | "hold"
  headline: string
  blockers: string[]
  cautions: string[]
  recommendations: string[]
}

export interface AIIncidentBrief {
  schemaVersion: string
  generatedAt: string
  app?: AIContextPacket["app"]
  release?: AIContextPacket["release"]
  readiness: AIContextPacket["readiness"]
  severity: "critical" | "high" | "medium" | "low"
  headline: string
  incidents: AIContextPacket["recentIncidents"]
  clusters: AIContextPacket["incidentClusters"]
  artifactRegressions: AIContextPacket["artifactRegressions"]
  recommendations: string[]
}

export interface AIDeploySummary {
  schemaVersion: string
  generatedAt: string
  app?: AIContextPacket["app"]
  release?: AIContextPacket["release"]
  readiness: AIContextPacket["readiness"]
  status: "ready" | "review" | "blocked"
  headline: string
  processEntrypoints: string[]
  handlerEntrypoints: string[]
  workerEntrypoint?: string
  artifactRegressions: AIContextPacket["artifactRegressions"]
  recommendations: string[]
}

export interface AIIncidentSnapshot {
  schemaVersion: string
  generatedAt: string
  app?: AIContextPacket["app"]
  release?: AIContextPacket["release"]
  readiness: AIContextPacket["readiness"]
  severity: "critical" | "high" | "medium" | "low"
  headline: string
  latestIncident?: AIContextPacket["recentIncidents"][number]
  incidentCount: number
  clusterCount: number
  clusters: AIContextPacket["incidentClusters"]
  hotspots: AIContextPacket["hotspots"]
  recommendations: string[]
}

export function createAIContextPacket(
  report: AIHealthReport,
  events: AIEvent[],
  latestDiagnostic?: Partial<AIDiagnostic>,
  reactiveTrace?: ReactiveTraceArtifact | null,
  agentInput: {
    currentMode?: AIOperationMode
    rules?: AIRulesFile
  } = {},
): AIContextPacket {
  const readiness = report.readiness ?? {
    deploy: { status: "ready" as const, reasons: [] },
    scaling: { status: "not-applicable" as const, reasons: [] },
  }
  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    agent: {
      currentMode: agentInput.currentMode ?? "inspect",
      availableModes: AI_OPERATION_MODES,
      transport: AI_TRANSPORT_CONTRACT,
      rules: agentInput.rules
        ? {
            path: agentInput.rules.path,
            content: agentInput.rules.content,
          }
        : undefined,
    },
    app: report.app,
    summary: {
      headline: buildHeadline(report),
      events: report.events.total,
      errors: report.diagnostics.errors,
      warnings: report.diagnostics.warnings,
    },
    readiness,
    release: report.release
      ? {
          appMode: report.release.appMode,
          runtimeKind: report.release.runtimeKind,
          processEntrypoints: report.release.processEntrypoints,
          handlerEntrypoints: report.release.handlerEntrypoints,
          workerEntrypoint: report.release.workerEntrypoint,
          routeCount: report.release.summary.routeCount,
          clientAssetCount: report.release.summary.clientAssetCount,
          prerenderedCount: report.release.summary.prerenderedCount,
          serverEntryCount: report.release.summary.serverEntryCount,
          generatedAt: report.release.generatedAt,
        }
      : undefined,
    latestDiagnostic,
    recentIncidents: report.incidents,
    incidentClusters: report.incidentClusters.map((cluster) => ({
      key: cluster.key,
      count: cluster.count,
      kind: cluster.kind,
      route: cluster.route,
      file: cluster.file,
      latestTs: cluster.latestTs,
    })),
    artifactRegressions: report.artifactRegressions.map((artifact) => ({
      key: artifact.key,
      phase: artifact.phase,
      path: artifact.path,
      version: artifact.version,
      errors: artifact.errors,
      warnings: artifact.warnings,
      successes: artifact.successes,
      latestTs: artifact.latestTs,
      latestStatus: artifact.latestStatus,
    })),
    hotspots: buildHotspots(events),
    reactiveTrace: reactiveTrace
      ? {
          schemaVersion: reactiveTrace.schemaVersion,
          nodes: reactiveTrace.nodes.length,
          edges: reactiveTrace.edges.length,
          events: reactiveTrace.events.length,
          latestEventKind: reactiveTrace.events.at(-1)?.kind,
        }
      : undefined,
    recommendations: buildRecommendations(report, latestDiagnostic, events, reactiveTrace),
  }
}

export function renderAIContextMarkdown(packet: AIContextPacket): string {
  const lines = [
    "# Gorsee AI Context",
    "",
    `Schema: ${packet.schemaVersion}`,
    "",
    `Generated: ${packet.generatedAt}`,
    "",
    ...(packet.app
      ? [
          "## App Context",
          "",
          `- Mode: ${packet.app.mode}`,
          `- Runtime topology: ${packet.app.runtimeTopology}`,
          "",
        ]
      : []),
    "## AI Agent",
    "",
    `- Current mode: ${packet.agent.currentMode}`,
    `- Model traffic: ${packet.agent.transport.modelTraffic}`,
    `- Bridge role: ${packet.agent.transport.bridgeRole}`,
    `- Production role: ${packet.agent.transport.productionRole}`,
    ...(
      packet.agent.rules
        ? [`- Rules: ${packet.agent.rules.path}`, ""]
        : [""]
    ),
    "## Summary",
    "",
    `- ${packet.summary.headline}`,
    `- Events: ${packet.summary.events}`,
    `- Errors: ${packet.summary.errors}`,
    `- Warnings: ${packet.summary.warnings}`,
  ]

  if (packet.latestDiagnostic?.code) {
    lines.push("", "## Latest Diagnostic", "", `- ${packet.latestDiagnostic.code}: ${packet.latestDiagnostic.message ?? ""}`.trim())
  }

  if (packet.release) {
    lines.push("", "## Release Artifact", "")
    lines.push(`- Mode: ${packet.release.appMode}`)
    lines.push(`- Runtime: ${packet.release.runtimeKind}`)
    lines.push(`- Routes: ${packet.release.routeCount}`)
    lines.push(`- Client assets: ${packet.release.clientAssetCount}`)
    lines.push(`- Prerendered pages: ${packet.release.prerenderedCount}`)
    lines.push(`- Server entries: ${packet.release.serverEntryCount}`)
    if (packet.release.processEntrypoints.length > 0) {
      lines.push(`- Process entrypoints: ${packet.release.processEntrypoints.join(", ")}`)
    }
    if (packet.release.handlerEntrypoints.length > 0) {
      lines.push(`- Handler entrypoints: ${packet.release.handlerEntrypoints.join(", ")}`)
    }
    if (packet.release.workerEntrypoint) {
      lines.push(`- Worker entrypoint: ${packet.release.workerEntrypoint}`)
    }
  }

  lines.push("", "## Readiness", "")
  lines.push(`- Deploy: ${packet.readiness.deploy.status}`)
  for (const reason of packet.readiness.deploy.reasons.slice(0, 3)) {
    lines.push(`  - ${reason}`)
  }
  lines.push(`- Scaling: ${packet.readiness.scaling.status}`)
  for (const reason of packet.readiness.scaling.reasons.slice(0, 3)) {
    lines.push(`  - ${reason}`)
  }

  if (packet.recentIncidents.length > 0) {
    lines.push("", "## Recent Incidents", "")
    for (const incident of packet.recentIncidents.slice(0, 10)) {
      const loc = incident.file
        ? ` (${incident.file}${incident.line ? `:${incident.line}` : ""})`
        : incident.route
          ? ` (${incident.route})`
          : ""
      lines.push(`- [${incident.kind}] ${incident.message}${loc}`)
    }
  }

  if (packet.incidentClusters.length > 0) {
    lines.push("", "## Incident Clusters", "")
    for (const cluster of packet.incidentClusters.slice(0, 5)) {
      const loc = cluster.file ? ` (${cluster.file})` : cluster.route ? ` (${cluster.route})` : ""
      lines.push(`- ${cluster.kind} × ${cluster.count}${loc}`)
    }
  }

  if (packet.artifactRegressions.length > 0) {
    lines.push("", "## Artifact Regressions", "")
    for (const artifact of packet.artifactRegressions.slice(0, 5)) {
      const details = [artifact.version, artifact.path].filter(Boolean).join(" ")
      lines.push(`- ${artifact.phase}: errors=${artifact.errors} warnings=${artifact.warnings} successes=${artifact.successes}${details ? ` (${details})` : ""}`)
    }
  }

  if (packet.hotspots.length > 0) {
    lines.push("", "## Hotspots", "")
    for (const hotspot of packet.hotspots) {
      lines.push(`- ${hotspot.kind}: ${hotspot.key} (${hotspot.count})`)
    }
  }

  if (packet.reactiveTrace) {
    lines.push("", "## Reactive Trace", "")
    lines.push(`- Schema: ${packet.reactiveTrace.schemaVersion}`)
    lines.push(`- Nodes: ${packet.reactiveTrace.nodes}`)
    lines.push(`- Edges: ${packet.reactiveTrace.edges}`)
    lines.push(`- Events: ${packet.reactiveTrace.events}`)
    if (packet.reactiveTrace.latestEventKind) {
      lines.push(`- Latest event: ${packet.reactiveTrace.latestEventKind}`)
    }
  }

  if (packet.agent.rules) {
    lines.push("", "## AI Rules", "", `Source: ${packet.agent.rules.path}`, "", packet.agent.rules.content)
  }

  if (packet.recommendations.length > 0) {
    lines.push("", "## Recommendations", "")
    for (const recommendation of packet.recommendations) {
      lines.push(`- ${recommendation}`)
    }
  }

  return lines.join("\n")
}

export function createAIReleaseBrief(packet: AIContextPacket): AIReleaseBrief {
  const blockers = [
    ...(packet.readiness.deploy.status === "blocked" ? packet.readiness.deploy.reasons : []),
    ...(packet.readiness.scaling.status === "blocked" ? packet.readiness.scaling.reasons : []),
  ]
  const cautions = [
    ...(packet.readiness.deploy.status === "caution" ? packet.readiness.deploy.reasons : []),
    ...(packet.readiness.scaling.status === "caution" ? packet.readiness.scaling.reasons : []),
  ]
  const verdict = blockers.length > 0 ? "hold" : cautions.length > 0 ? "review" : "ship"

  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    app: packet.app,
    release: packet.release,
    readiness: packet.readiness,
    verdict,
    headline: verdict === "hold"
      ? "Release should not be promoted yet."
      : verdict === "review"
        ? "Release is close, but needs operator review."
        : "Release looks ready for promotion.",
    blockers,
    cautions,
    recommendations: packet.recommendations,
  }
}

export function renderAIReleaseBriefMarkdown(brief: AIReleaseBrief): string {
  const lines = [
    "# Gorsee AI Release Brief",
    "",
    `Schema: ${brief.schemaVersion}`,
    "",
    `Generated: ${brief.generatedAt}`,
    "",
    `Verdict: ${brief.verdict}`,
    "",
    brief.headline,
  ]

  if (brief.release) {
    lines.push("", "## Release", "")
    lines.push(`- Mode: ${brief.release.appMode}`)
    lines.push(`- Runtime: ${brief.release.runtimeKind}`)
    lines.push(`- Routes: ${brief.release.routeCount}`)
    lines.push(`- Client assets: ${brief.release.clientAssetCount}`)
    lines.push(`- Server entries: ${brief.release.serverEntryCount}`)
  }

  lines.push("", "## Readiness", "")
  lines.push(`- Deploy: ${brief.readiness.deploy.status}`)
  lines.push(`- Scaling: ${brief.readiness.scaling.status}`)

  if (brief.blockers.length > 0) {
    lines.push("", "## Blockers", "")
    for (const blocker of brief.blockers) lines.push(`- ${blocker}`)
  }

  if (brief.cautions.length > 0) {
    lines.push("", "## Cautions", "")
    for (const caution of brief.cautions) lines.push(`- ${caution}`)
  }

  if (brief.recommendations.length > 0) {
    lines.push("", "## Recommendations", "")
    for (const recommendation of brief.recommendations.slice(0, 5)) lines.push(`- ${recommendation}`)
  }

  return lines.join("\n")
}

export function createAIIncidentBrief(packet: AIContextPacket): AIIncidentBrief {
  const severity = packet.summary.errors > 0
    ? packet.incidentClusters.length > 0 && packet.incidentClusters[0]!.count > 1
      ? "critical"
      : "high"
    : packet.summary.warnings > 0
      ? "medium"
      : "low"

  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    app: packet.app,
    release: packet.release,
    readiness: packet.readiness,
    severity,
    headline: packet.recentIncidents[0]?.message ?? packet.summary.headline,
    incidents: packet.recentIncidents,
    clusters: packet.incidentClusters,
    artifactRegressions: packet.artifactRegressions,
    recommendations: packet.recommendations,
  }
}

export function renderAIIncidentBriefMarkdown(brief: AIIncidentBrief): string {
  const lines = [
    "# Gorsee AI Incident Brief",
    "",
    `Schema: ${brief.schemaVersion}`,
    "",
    `Generated: ${brief.generatedAt}`,
    "",
    `Severity: ${brief.severity}`,
    "",
    brief.headline,
  ]

  if (brief.release) {
    lines.push("", "## Release Context", "")
    lines.push(`- Mode: ${brief.release.appMode}`)
    lines.push(`- Runtime: ${brief.release.runtimeKind}`)
  }

  if (brief.incidents.length > 0) {
    lines.push("", "## Incidents", "")
    for (const incident of brief.incidents.slice(0, 5)) {
      const loc = incident.file
        ? ` (${incident.file}${incident.line ? `:${incident.line}` : ""})`
        : incident.route
          ? ` (${incident.route})`
          : ""
      lines.push(`- [${incident.kind}] ${incident.message}${loc}`)
    }
  }

  if (brief.clusters.length > 0) {
    lines.push("", "## Clusters", "")
    for (const cluster of brief.clusters.slice(0, 5)) {
      lines.push(`- ${cluster.kind} × ${cluster.count}`)
    }
  }

  if (brief.recommendations.length > 0) {
    lines.push("", "## Recommendations", "")
    for (const recommendation of brief.recommendations.slice(0, 5)) lines.push(`- ${recommendation}`)
  }

  return lines.join("\n")
}

export function createAIDeploySummary(packet: AIContextPacket): AIDeploySummary {
  const status = packet.readiness.deploy.status === "blocked"
    ? "blocked"
    : packet.readiness.deploy.status === "caution" || packet.readiness.scaling.status === "caution" || packet.readiness.scaling.status === "blocked"
      ? "review"
      : "ready"

  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    app: packet.app,
    release: packet.release,
    readiness: packet.readiness,
    status,
    headline: status === "blocked"
      ? "Deploy promotion is currently blocked by release or diagnostics signals."
      : status === "review"
        ? "Deploy promotion needs operator review before rollout."
        : "Deploy promotion looks ready from the current local artifact surface.",
    processEntrypoints: packet.release?.processEntrypoints ?? [],
    handlerEntrypoints: packet.release?.handlerEntrypoints ?? [],
    workerEntrypoint: packet.release?.workerEntrypoint,
    artifactRegressions: packet.artifactRegressions,
    recommendations: packet.recommendations,
  }
}

export function renderAIDeploySummaryMarkdown(summary: AIDeploySummary): string {
  const lines = [
    "# Gorsee AI Deploy Summary",
    "",
    `Schema: ${summary.schemaVersion}`,
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    `Status: ${summary.status}`,
    "",
    summary.headline,
  ]

  if (summary.app) {
    lines.push("", "## App Context", "")
    lines.push(`- Mode: ${summary.app.mode}`)
    lines.push(`- Runtime topology: ${summary.app.runtimeTopology}`)
  }

  if (summary.release) {
    lines.push("", "## Release Context", "")
    lines.push(`- Mode: ${summary.release.appMode}`)
    lines.push(`- Runtime: ${summary.release.runtimeKind}`)
    lines.push(`- Routes: ${summary.release.routeCount}`)
    lines.push(`- Client assets: ${summary.release.clientAssetCount}`)
    lines.push(`- Prerendered pages: ${summary.release.prerenderedCount}`)
    lines.push(`- Server entries: ${summary.release.serverEntryCount}`)
  }

  lines.push("", "## Entrypoints", "")
  lines.push(`- Process: ${summary.processEntrypoints.length > 0 ? summary.processEntrypoints.join(", ") : "none"}`)
  lines.push(`- Handlers: ${summary.handlerEntrypoints.length > 0 ? summary.handlerEntrypoints.join(", ") : "none"}`)
  lines.push(`- Worker: ${summary.workerEntrypoint ?? "none"}`)

  lines.push("", "## Readiness", "")
  lines.push(`- Deploy: ${summary.readiness.deploy.status}`)
  lines.push(`- Scaling: ${summary.readiness.scaling.status}`)

  if (summary.artifactRegressions.length > 0) {
    lines.push("", "## Artifact Regressions", "")
    for (const regression of summary.artifactRegressions.slice(0, 5)) {
      const path = regression.path ? ` (${regression.path})` : ""
      lines.push(`- ${regression.phase} ${regression.latestStatus}${path}`)
    }
  }

  if (summary.recommendations.length > 0) {
    lines.push("", "## Recommendations", "")
    for (const recommendation of summary.recommendations.slice(0, 5)) lines.push(`- ${recommendation}`)
  }

  return lines.join("\n")
}

export function createAIIncidentSnapshot(packet: AIContextPacket): AIIncidentSnapshot {
  const brief = createAIIncidentBrief(packet)
  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    app: packet.app,
    release: packet.release,
    readiness: packet.readiness,
    severity: brief.severity,
    headline: brief.headline,
    latestIncident: packet.recentIncidents[0],
    incidentCount: packet.recentIncidents.length,
    clusterCount: packet.incidentClusters.length,
    clusters: packet.incidentClusters,
    hotspots: packet.hotspots,
    recommendations: packet.recommendations,
  }
}

export function renderAIIncidentSnapshotMarkdown(snapshot: AIIncidentSnapshot): string {
  const lines = [
    "# Gorsee AI Incident Snapshot",
    "",
    `Schema: ${snapshot.schemaVersion}`,
    "",
    `Generated: ${snapshot.generatedAt}`,
    "",
    `Severity: ${snapshot.severity}`,
    "",
    snapshot.headline,
  ]

  if (snapshot.app) {
    lines.push("", "## App Context", "")
    lines.push(`- Mode: ${snapshot.app.mode}`)
    lines.push(`- Runtime topology: ${snapshot.app.runtimeTopology}`)
  }

  if (snapshot.release) {
    lines.push("", "## Release Context", "")
    lines.push(`- Mode: ${snapshot.release.appMode}`)
    lines.push(`- Runtime: ${snapshot.release.runtimeKind}`)
  }

  lines.push("", "## Incident Overview", "")
  lines.push(`- Incidents: ${snapshot.incidentCount}`)
  lines.push(`- Clusters: ${snapshot.clusterCount}`)
  if (snapshot.latestIncident) {
    lines.push(`- Latest: [${snapshot.latestIncident.kind}] ${snapshot.latestIncident.message}`)
  }

  if (snapshot.clusters.length > 0) {
    lines.push("", "## Clusters", "")
    for (const cluster of snapshot.clusters.slice(0, 5)) {
      lines.push(`- ${cluster.kind} × ${cluster.count}`)
    }
  }

  if (snapshot.hotspots.length > 0) {
    lines.push("", "## Hotspots", "")
    for (const hotspot of snapshot.hotspots.slice(0, 5)) {
      lines.push(`- ${hotspot.kind}: ${hotspot.key} × ${hotspot.count}`)
    }
  }

  if (snapshot.recommendations.length > 0) {
    lines.push("", "## Recommendations", "")
    for (const recommendation of snapshot.recommendations.slice(0, 5)) lines.push(`- ${recommendation}`)
  }

  return lines.join("\n")
}

function buildHeadline(report: AIHealthReport): string {
  const readiness = report.readiness ?? {
    deploy: { status: "ready" as const, reasons: [] },
    scaling: { status: "not-applicable" as const, reasons: [] },
  }
  if (report.diagnostics.errors > 0) return "Project currently has AI-observed errors that need attention."
  if (readiness.deploy.status === "blocked") return "Deploy readiness is currently blocked by release, diagnostic, or artifact signals."
  if (readiness.scaling.status === "blocked") return "Scaling readiness is currently blocked by multi-instance or distributed-state signals."
  if (report.diagnostics.warnings > 0) return "Project is stable but has warnings worth reviewing."
  if (report.release) return `Release artifact is present for ${report.release.appMode} (${report.release.runtimeKind}).`
  if (report.events.total === 0) return "AI observability is enabled but no events were collected yet."
  return "Project looks healthy from the current AI event stream."
}

function buildHotspots(events: AIEvent[]): Array<{ key: string; count: number; kind: "route" | "file" | "event" }> {
  const routeCounts = new Map<string, number>()
  const fileCounts = new Map<string, number>()
  const kindCounts = new Map<string, number>()

  for (const event of events) {
    if (event.route) routeCounts.set(event.route, (routeCounts.get(event.route) ?? 0) + 1)
    if (event.file) fileCounts.set(event.file, (fileCounts.get(event.file) ?? 0) + 1)
    kindCounts.set(event.kind, (kindCounts.get(event.kind) ?? 0) + 1)
  }

  return [
    ...topEntries(routeCounts, "route"),
    ...topEntries(fileCounts, "file"),
    ...topEntries(kindCounts, "event"),
  ].slice(0, 8)
}

function topEntries(
  source: Map<string, number>,
  kind: "route" | "file" | "event",
): Array<{ key: string; count: number; kind: "route" | "file" | "event" }> {
  return [...source.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => ({ key, count, kind }))
}

function buildRecommendations(
  report: AIHealthReport,
  latestDiagnostic: Partial<AIDiagnostic> | undefined,
  events: AIEvent[],
  reactiveTrace?: ReactiveTraceArtifact | null,
): string[] {
  const recommendations: string[] = []
  const readiness = report.readiness ?? {
    deploy: { status: "ready" as const, reasons: [] },
    scaling: { status: "not-applicable" as const, reasons: [] },
  }
  const errorEvents = events.filter((event) => event.severity === "error")
  const requestErrors = events.filter((event) => event.kind === "request.error")

  if (latestDiagnostic?.code) {
    recommendations.push(`Investigate the latest diagnostic ${latestDiagnostic.code} before relying on this context in automation.`)
  }
  if (requestErrors.length > 0) {
    recommendations.push("Review request.error events first; they are the strongest signal of user-facing runtime regressions.")
  }
  if (report.diagnostics.errors > 0 && report.events.total > 0) {
    recommendations.push("Use `gorsee ai tail --limit 50 --json` to inspect correlated runtime/build/check events around the failure.")
  }
  if (errorEvents.some((event) => event.kind.startsWith("build."))) {
    recommendations.push("Run `gorsee ai doctor` after the next build to verify whether build-phase errors persist.")
  }
  if (report.artifactRegressions.length > 0) {
    recommendations.push("Review artifact regressions before shipping; release/deploy/build artifacts have recorded failures or warnings.")
  }
  if (report.release) {
    recommendations.push(`Validate dist/release.json before promotion; current runtime kind is ${report.release.runtimeKind}.`)
  }
  if (readiness.deploy.status !== "ready") {
    recommendations.push(`Deploy readiness is ${readiness.deploy.status}; resolve the reported release/artifact issues before promotion.`)
  }
  if (readiness.scaling.status === "blocked" || readiness.scaling.status === "caution") {
    recommendations.push(`Scaling readiness is ${readiness.scaling.status}; review runtime.topology and distributed-state signals before horizontal rollout.`)
  }
  if (reactiveTrace && reactiveTrace.events.length > 0) {
    recommendations.push("Reactive trace data is available; inspect dependency edges and invalidation events before changing resource or mutation behavior.")
  }
  if (recommendations.length === 0) {
    recommendations.push("No urgent AI-observed issues. Use `gorsee ai export --format markdown` to share a compact status packet with an agent.")
  }

  return recommendations
}
