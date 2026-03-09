import type { AIDiagnostic, AIEvent } from "./index.ts"
import type { AIHealthReport } from "./store.ts"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "./contracts.ts"
import type { ReactiveTraceArtifact } from "../reactive/diagnostics.ts"

export interface AIContextPacket {
  schemaVersion: string
  generatedAt: string
  summary: {
    headline: string
    events: number
    errors: number
    warnings: number
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

export function createAIContextPacket(
  report: AIHealthReport,
  events: AIEvent[],
  latestDiagnostic?: Partial<AIDiagnostic>,
  reactiveTrace?: ReactiveTraceArtifact | null,
): AIContextPacket {
  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    summary: {
      headline: buildHeadline(report),
      events: report.events.total,
      errors: report.diagnostics.errors,
      warnings: report.diagnostics.warnings,
    },
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

  if (packet.recommendations.length > 0) {
    lines.push("", "## Recommendations", "")
    for (const recommendation of packet.recommendations) {
      lines.push(`- ${recommendation}`)
    }
  }

  return lines.join("\n")
}

function buildHeadline(report: AIHealthReport): string {
  if (report.diagnostics.errors > 0) return "Project currently has AI-observed errors that need attention."
  if (report.diagnostics.warnings > 0) return "Project is stable but has warnings worth reviewing."
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
  if (reactiveTrace && reactiveTrace.events.length > 0) {
    recommendations.push("Reactive trace data is available; inspect dependency edges and invalidation events before changing resource or mutation behavior.")
  }
  if (recommendations.length === 0) {
    recommendations.push("No urgent AI-observed issues. Use `gorsee ai export --format markdown` to share a compact status packet with an agent.")
  }

  return recommendations
}
