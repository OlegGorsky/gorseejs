import { readFile } from "node:fs/promises"
import { join, isAbsolute } from "node:path"
import type { AIDiagnostic, AIEvent } from "./index.ts"
import type { AIStorePaths, AIHealthReport } from "./store.ts"
import { buildAIHealthReport, readAIDiagnosticsSnapshot, readAIEvents, readReactiveTraceArtifact } from "./store.ts"
import { createAIContextPacket, renderAIContextMarkdown, type AIContextPacket } from "./summary.ts"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "./contracts.ts"

export interface AIContextSnippet {
  file: string
  startLine: number
  endLine: number
  reason: string
  score: number
  content: string
}

export interface AIContextBundle {
  schemaVersion: string
  generatedAt: string
  packet: AIContextPacket
  report: AIHealthReport
  diagnostics: { updatedAt?: string; sessionId?: string; latest?: Partial<AIDiagnostic> } | null
  recentEvents: AIEvent[]
  artifacts: Array<{
    kind: string
    path?: string
    version?: string
    message: string
    ts: string
  }>
  rootCauses: Array<{
    key: string
    score: number
    kind: string
    route?: string
    file?: string
    latestTs: string
    reasons: string[]
  }>
  snippets: AIContextSnippet[]
}

export async function buildAIContextBundle(
  cwd: string,
  paths: AIStorePaths,
  options: { limit?: number; snippetRadius?: number; maxSnippets?: number } = {},
): Promise<AIContextBundle> {
  const events = await readAIEvents(paths.eventsPath, { limit: options.limit ?? 200 })
  const diagnostics = await readAIDiagnosticsSnapshot(paths.diagnosticsPath)
  const reactiveTrace = await readReactiveTraceArtifact(paths.reactiveTracePath)
  const report = await buildAIHealthReport(paths, { limit: options.limit ?? 200 })
  const packet = createAIContextPacket(report, events, diagnostics?.latest, reactiveTrace)
  const rootCauses = buildRootCauseRanking(report, diagnostics?.latest, events)
  const snippets = await collectSnippets(cwd, diagnostics?.latest, report, events, rootCauses, {
    snippetRadius: options.snippetRadius ?? 6,
    maxSnippets: options.maxSnippets ?? 5,
  })

  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    packet,
    report,
    diagnostics,
    recentEvents: events.slice(-50),
    artifacts: collectArtifacts(events),
    rootCauses,
    snippets,
  }
}

export function renderAIContextBundleMarkdown(bundle: AIContextBundle): string {
  const lines = [
    renderAIContextMarkdown(bundle.packet),
    "",
    `Bundle Schema: ${bundle.schemaVersion}`,
    "",
    "## Root Causes",
    "",
  ]

  if (bundle.artifacts.length > 0) {
    lines.push("## Artifacts", "")
    for (const artifact of bundle.artifacts.slice(0, 5)) {
      const details = [artifact.version, artifact.path].filter(Boolean).join(" ")
      lines.push(`- ${artifact.kind}: ${artifact.message}${details ? ` (${details})` : ""}`)
    }
    lines.push("")
  }

  if (bundle.rootCauses.length === 0) {
    lines.push("- No root-cause candidates ranked yet.")
  } else {
    for (const cause of bundle.rootCauses.slice(0, 5)) {
      const loc = cause.file ? ` (${cause.file})` : cause.route ? ` (${cause.route})` : ""
      lines.push(`- ${cause.kind} score=${cause.score}${loc}`)
      if (cause.reasons.length > 0) {
        lines.push(`  reasons: ${cause.reasons.join(", ")}`)
      }
    }
  }

  lines.push(
    "",
    "## Snippets",
    "",
  )

  if (bundle.snippets.length === 0) {
    lines.push("- No relevant snippets collected.")
  } else {
    for (const snippet of bundle.snippets) {
      lines.push(`### ${snippet.file}:${snippet.startLine}-${snippet.endLine}`)
      lines.push("")
      lines.push(`Reason: ${snippet.reason} (score: ${snippet.score})`)
      lines.push("")
      lines.push("```ts")
      lines.push(snippet.content)
      lines.push("```")
      lines.push("")
    }
  }

  return lines.join("\n")
}

function collectArtifacts(events: AIEvent[]): AIContextBundle["artifacts"] {
  return events
    .filter((event) =>
      event.kind.startsWith("release.")
      || event.kind.startsWith("deploy.")
      || event.kind === "build.summary")
    .map((event) => ({
      kind: event.kind,
      path: typeof event.data?.artifact === "string" ? event.data.artifact : undefined,
      version: typeof event.data?.version === "string" ? event.data.version : undefined,
      message: event.message,
      ts: event.ts,
    }))
    .slice(-10)
    .reverse()
}

async function collectSnippets(
  cwd: string,
  latestDiagnostic: Partial<AIDiagnostic> | undefined,
  report: AIHealthReport,
  events: AIEvent[],
  rootCauses: AIContextBundle["rootCauses"],
  options: { snippetRadius: number; maxSnippets: number },
): Promise<AIContextSnippet[]> {
  const candidates = new Map<string, { line?: number; reason: string; score: number }>()
  const fileFrequency = new Map<string, number>()
  const latestIncident = report.incidents[0]
  const topCause = rootCauses[0]
  const focusRoute = topCause?.route ?? latestDiagnostic?.route ?? latestIncident?.route
  const focusRequestId = topCause?.key.startsWith("request:")
    ? topCause.key.slice("request:".length)
    : [...events].reverse().find((event) => event.severity === "error" || event.kind === "request.error")?.requestId
  const focusTraceId = topCause?.key.startsWith("trace:")
    ? topCause.key.slice("trace:".length)
    : [...events].reverse().find((event) => event.severity === "error" || event.kind === "request.error")?.traceId

  for (const event of events) {
    if (event.file) fileFrequency.set(event.file, (fileFrequency.get(event.file) ?? 0) + 1)
  }

  if (latestDiagnostic?.file) {
    candidates.set(latestDiagnostic.file, {
      line: latestDiagnostic.line,
      reason: latestDiagnostic.code ? `latest diagnostic ${latestDiagnostic.code}` : "latest diagnostic",
      score: 100,
    })
  }
  for (const incident of report.incidents) {
    if (!incident.file) continue
    const score = 60 + (fileFrequency.get(incident.file) ?? 0) * 5 + (incident.code ? 10 : 0)
    const existing = candidates.get(incident.file)
    if (!existing || score > existing.score) {
      candidates.set(incident.file, {
        line: incident.line,
        reason: incident.code ? `incident ${incident.code}` : incident.kind,
        score,
      })
    }
  }
  for (const event of events.filter((entry) => entry.severity === "error" || entry.kind === "request.error")) {
    if (!event.file) continue
    let score = (event.severity === "error" ? 40 : 20) + (fileFrequency.get(event.file) ?? 0) * 5
    if (focusRequestId && event.requestId === focusRequestId) score += 20
    if (focusTraceId && event.traceId === focusTraceId) score += 20
    const existing = candidates.get(event.file)
    if (!existing || score > existing.score) {
      candidates.set(event.file, {
        line: event.line,
        reason: event.kind,
        score,
      })
    }
  }
  for (const cause of rootCauses) {
    if (cause.file) {
      const existing = candidates.get(cause.file)
      if (!existing || cause.score > existing.score) {
        candidates.set(cause.file, {
          line: latestDiagnostic?.file === cause.file ? latestDiagnostic.line : undefined,
          reason: `root cause ${cause.key}`,
          score: cause.score,
        })
      }
    }
    if (cause.route) {
      for (const candidate of inferRouteFiles(cause.route)) {
        const score = cause.score - (candidate.isLayout ? 8 : 0)
        const existing = candidates.get(candidate.file)
        if (!existing || score > existing.score) {
          candidates.set(candidate.file, {
            line: 1,
            reason: `root cause ${cause.key}`,
            score,
          })
        }
      }
    }
  }
  if (focusRoute) {
    for (const candidate of inferRouteFiles(focusRoute)) {
      const score = 55 + (fileFrequency.get(candidate.file) ?? 0) * 5 + (candidate.isLayout ? 5 : 0)
      const existing = candidates.get(candidate.file)
      if (!existing || score > existing.score) {
        candidates.set(candidate.file, {
          line: 1,
          reason: candidate.reason,
          score,
        })
      }
    }
  }

  const snippets: AIContextSnippet[] = []
  const ranked = [...candidates.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, options.maxSnippets)

  for (const [file, meta] of ranked) {
    const snippet = await readSnippet(cwd, file, meta.line, meta.reason, meta.score, options.snippetRadius)
    if (snippet) snippets.push(snippet)
  }
  return snippets
}

function buildRootCauseRanking(
  report: AIHealthReport,
  latestDiagnostic: Partial<AIDiagnostic> | undefined,
  events: AIEvent[],
): AIContextBundle["rootCauses"] {
  const causes = report.incidentClusters.map((cluster) => {
    let score = cluster.count * 30
    if (cluster.traceId) score += 25
    if (cluster.requestId) score += 20
    if (cluster.file) score += 15
    if (cluster.route) score += 10
    if (latestDiagnostic?.file && cluster.file === latestDiagnostic.file) score += 40
    if (latestDiagnostic?.route && cluster.route === latestDiagnostic.route) score += 25
    if (cluster.codes.length > 0) score += 10
    if (events.some((event) => event.traceId && cluster.traceId && event.traceId === cluster.traceId && event.kind === "request.error")) score += 10
    return {
      key: cluster.key,
      score,
      kind: cluster.kind,
      route: cluster.route,
      file: cluster.file,
      latestTs: cluster.latestTs,
      reasons: [
        cluster.traceId ? "shared trace" : "",
        cluster.requestId ? "shared request" : "",
        cluster.file ? "file-locality" : "",
        cluster.route ? "route-locality" : "",
        cluster.count > 1 ? `repeated x${cluster.count}` : "",
      ].filter(Boolean),
    }
  })

  if (latestDiagnostic?.file && !causes.some((cause) => cause.file === latestDiagnostic.file)) {
    causes.push({
      key: `diagnostic:${latestDiagnostic.code ?? "latest"}`,
      score: 120,
      kind: "diagnostic.issue",
      file: latestDiagnostic.file,
      route: latestDiagnostic.route,
      latestTs: new Date().toISOString(),
      reasons: ["latest diagnostic"],
    })
  }

  return causes.sort((a, b) => b.score - a.score).slice(0, 8)
}

async function readSnippet(
  cwd: string,
  file: string,
  line: number | undefined,
  reason: string,
  score: number,
  radius: number,
): Promise<AIContextSnippet | null> {
  const path = isAbsolute(file) ? file : join(cwd, file)
  let content: string
  try {
    content = await readFile(path, "utf-8")
  } catch {
    return null
  }

  const lines = content.split("\n")
  const focus = Math.max(1, Math.min(line ?? 1, lines.length))
  const startLine = Math.max(1, focus - radius)
  const endLine = Math.min(lines.length, focus + radius)
  return {
    file,
    startLine,
    endLine,
    reason,
    score,
    content: lines.slice(startLine - 1, endLine).join("\n"),
  }
}

function inferRouteFiles(route: string): Array<{ file: string; reason: string; isLayout?: boolean }> {
  const normalized = route === "/" ? "" : route.replace(/^\/+/, "")
  const segments = normalized.split("/").filter(Boolean)
  const files: Array<{ file: string; reason: string; isLayout?: boolean }> = []

  if (segments.length === 0) {
    files.push({ file: "routes/index.tsx", reason: "focus route /" })
    files.push({ file: "routes/_layout.tsx", reason: "root layout for focus route", isLayout: true })
    return files
  }

  const routePath = segments.join("/")
  files.push({ file: `routes/${routePath}.tsx`, reason: `focus route ${route}` })
  files.push({ file: `routes/${routePath}/index.tsx`, reason: `focus route ${route} index` })
  files.push({ file: "routes/_layout.tsx", reason: "root layout for focus route", isLayout: true })

  for (let i = 1; i <= segments.length; i++) {
    files.push({
      file: `routes/${segments.slice(0, i).join("/")}/_layout.tsx`,
      reason: `layout for ${route}`,
      isLayout: true,
    })
  }

  return dedupe(files)
}

function dedupe<T extends { file: string }>(files: T[]): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const file of files) {
    if (seen.has(file.file)) continue
    seen.add(file.file)
    unique.push(file)
  }
  return unique
}
