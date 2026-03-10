import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { AIAppContext, AIDiagnostic, AIEvent } from "./index.ts"
import { MAX_AI_EVENTS_READ, safeJSONParse } from "./json.ts"
import type { ReactiveTraceArtifact } from "../reactive/diagnostics.ts"
import type { ReleaseArtifact } from "../server/manifest.ts"

export interface AIStorePaths {
  eventsPath: string
  diagnosticsPath: string
  reactiveTracePath: string
  releaseArtifactPath?: string
}

export interface AIHealthReport {
  app?: AIAppContext
  release?: {
    appMode: ReleaseArtifact["appMode"]
    runtimeKind: ReleaseArtifact["runtime"]["kind"]
    processEntrypoints: string[]
    handlerEntrypoints: string[]
    workerEntrypoint?: string
    summary: ReleaseArtifact["summary"]
    generatedAt: string
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
  events: {
    total: number
    bySeverity: Record<string, number>
    byKind: Record<string, number>
    latest?: AIEvent
  }
  diagnostics: {
    total: number
    latest?: AIDiagnostic
    errors: number
    warnings: number
  }
  incidents: Array<{
    kind: string
    message: string
    ts: string
    route?: string
    file?: string
    line?: number
    code?: string
  }>
  incidentClusters: Array<{
    key: string
    count: number
    kind: string
    latestTs: string
    route?: string
    file?: string
    requestId?: string
    traceId?: string
    messages: string[]
    codes: string[]
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
    messages: string[]
  }>
}

export function resolveAIStorePaths(cwd: string): AIStorePaths {
  return {
    eventsPath: join(cwd, ".gorsee", "ai-events.jsonl"),
    diagnosticsPath: join(cwd, ".gorsee", "ai-diagnostics.json"),
    reactiveTracePath: join(cwd, ".gorsee", "reactive-trace.json"),
    releaseArtifactPath: join(cwd, "dist", "release.json"),
  }
}

export async function readAIEvents(
  path: string,
  options: { limit?: number } = {},
): Promise<AIEvent[]> {
  const content = await safeReadFile(path)
  if (!content) return []

  const parsed = content
    .split("\n")
    .slice(-MAX_AI_EVENTS_READ)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      return safeJSONParse<AIEvent>(line)
    })
    .filter((event): event is AIEvent => event !== null)

  if (options.limit && options.limit > 0) {
    return parsed.slice(-options.limit)
  }
  return parsed
}

export async function readAIDiagnosticsSnapshot(
  path: string,
): Promise<{ updatedAt?: string; sessionId?: string; app?: AIAppContext; latest?: Partial<AIDiagnostic> } | null> {
  const content = await safeReadFile(path)
  if (!content) return null
  return safeJSONParse<{ updatedAt?: string; sessionId?: string; app?: AIAppContext; latest?: Partial<AIDiagnostic> }>(content)
}

export async function readReactiveTraceArtifact(
  path: string,
): Promise<ReactiveTraceArtifact | null> {
  const content = await safeReadFile(path)
  if (!content) return null
  return safeJSONParse<ReactiveTraceArtifact>(content)
}

export async function readReleaseArtifact(
  path: string,
): Promise<ReleaseArtifact | null> {
  const content = await safeReadFile(path)
  if (!content) return null
  return safeJSONParse<ReleaseArtifact>(content)
}

export async function buildAIHealthReport(paths: AIStorePaths, options: { limit?: number } = {}): Promise<AIHealthReport> {
  const events = await readAIEvents(paths.eventsPath, options)
  const snapshot = await readAIDiagnosticsSnapshot(paths.diagnosticsPath)
  const releaseArtifact = paths.releaseArtifactPath
    ? await readReleaseArtifact(paths.releaseArtifactPath)
    : null
  const bySeverity: Record<string, number> = {}
  const byKind: Record<string, number> = {}
  let errors = 0
  let warnings = 0

  for (const event of events) {
    bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1
    byKind[event.kind] = (byKind[event.kind] ?? 0) + 1
    if (event.severity === "error") errors++
    if (event.severity === "warn") warnings++
  }

  const incidents = events
    .filter((event) => event.severity === "error" || event.kind === "diagnostic.issue" || event.kind === "request.error")
    .slice(-10)
    .reverse()
    .map((event) => ({
      kind: event.kind,
      message: event.message,
      ts: event.ts,
      route: event.route,
      file: event.file,
      line: event.line,
      code: event.code,
    }))
  const incidentClusters = buildIncidentClusters(events)
  const artifactRegressions = buildArtifactRegressions(events)
  const appContext = snapshot?.app ?? [...events].reverse().find((event) => event.app)?.app
  const releaseContext = releaseArtifact
    ? {
        appMode: releaseArtifact.appMode,
        runtimeKind: releaseArtifact.runtime.kind,
        processEntrypoints: releaseArtifact.runtime.processEntrypoints,
        handlerEntrypoints: releaseArtifact.runtime.handlerEntrypoints,
        workerEntrypoint: releaseArtifact.runtime.workerEntrypoint,
        summary: releaseArtifact.summary,
        generatedAt: releaseArtifact.generatedAt,
      }
    : undefined

  return {
    app: appContext,
    release: releaseContext,
    readiness: {
      deploy: buildDeployReadiness({
        app: appContext,
        release: releaseContext,
        diagnosticsErrors: errors,
        diagnosticsWarnings: warnings,
        incidents,
        artifactRegressions,
      }),
      scaling: buildScalingReadiness({
        app: appContext,
        release: releaseContext,
        events,
      }),
    },
    events: {
      total: events.length,
      bySeverity,
      byKind,
      latest: events.at(-1),
    },
    diagnostics: {
      total: snapshot?.latest ? 1 : 0,
      latest: snapshot?.latest as AIDiagnostic | undefined,
      errors,
      warnings,
    },
    incidents,
    incidentClusters,
    artifactRegressions,
  }
}

function buildDeployReadiness(input: {
  app?: AIAppContext
  release?: AIHealthReport["release"]
  diagnosticsErrors: number
  diagnosticsWarnings: number
  incidents: AIHealthReport["incidents"]
  artifactRegressions: AIHealthReport["artifactRegressions"]
}): AIHealthReport["readiness"]["deploy"] {
  const reasons: string[] = []

  if (!input.release) {
    reasons.push("dist/release.json is missing; release-level runtime context is not available.")
  }
  if (input.app && input.release && input.app.mode !== input.release.appMode) {
    reasons.push(`app.mode (${input.app.mode}) does not match release artifact mode (${input.release.appMode}).`)
  }
  if (input.diagnosticsErrors > 0) {
    reasons.push(`AI diagnostics currently report ${input.diagnosticsErrors} error event(s).`)
  }
  if (input.artifactRegressions.some((entry) => entry.errors > 0)) {
    reasons.push("artifact regressions contain error-level failures.")
  }
  if (reasons.length > 0) {
    return { status: "blocked", reasons }
  }

  if (input.diagnosticsWarnings > 0) {
    reasons.push(`AI diagnostics currently report ${input.diagnosticsWarnings} warning event(s).`)
  }
  if (input.incidents.length > 0) {
    reasons.push(`recent incident history is non-empty (${input.incidents.length}).`)
  }
  if (input.artifactRegressions.some((entry) => entry.warnings > 0)) {
    reasons.push("artifact regressions contain warning-level drift.")
  }
  if (reasons.length > 0) {
    return { status: "caution", reasons }
  }

  reasons.push(input.release
    ? `release artifact is aligned for ${input.release.appMode} (${input.release.runtimeKind}).`
    : "no blocking deploy signals were found.")
  return { status: "ready", reasons }
}

function buildScalingReadiness(input: {
  app?: AIAppContext
  release?: AIHealthReport["release"]
  events: AIEvent[]
}): AIHealthReport["readiness"]["scaling"] {
  const reasons: string[] = []
  const eventCodes = new Set(input.events.map((event) => event.code).filter((code): code is string => Boolean(code)))

  if (input.release?.appMode === "frontend") {
    return {
      status: "not-applicable",
      reasons: ["frontend-static release artifacts do not own a multi-instance server runtime."],
    }
  }

  if (input.app?.runtimeTopology !== "multi-instance") {
    return {
      status: "not-applicable",
      reasons: ["runtime.topology is not declared as multi-instance."],
    }
  }

  if (!input.release) {
    reasons.push("dist/release.json is missing; scaling cannot be assessed against the built runtime.")
  }
  if (input.release && input.release.runtimeKind === "frontend-static") {
    reasons.push("release runtime kind is frontend-static, which cannot satisfy multi-instance server scaling.")
  }
  for (const code of ["W917", "W918", "W919", "W920"]) {
    if (eventCodes.has(code)) {
      reasons.push(`check/runtime events still report ${code}, which blocks distributed scaling readiness.`)
    }
  }
  if (reasons.length > 0) {
    return { status: "blocked", reasons }
  }

  if (eventCodes.has("W921")) {
    return {
      status: "caution",
      reasons: ["multi-instance runtime is configured, but AI observability does not yet forward to a bridge/aggregator (W921)."],
    }
  }

  return {
    status: "ready",
    reasons: ["multi-instance topology is declared and no distributed-state blocker signals are present."],
  }
}

function buildIncidentClusters(events: AIEvent[]): AIHealthReport["incidentClusters"] {
  const clusters = new Map<string, AIHealthReport["incidentClusters"][number]>()

  for (const event of events) {
    if (!(event.severity === "error" || event.kind === "diagnostic.issue" || event.kind === "request.error")) continue
    const key = event.traceId
      ? `trace:${event.traceId}`
      : event.requestId
        ? `request:${event.requestId}`
        : event.file
          ? `file:${event.file}`
          : event.route
            ? `route:${event.route}`
            : `kind:${event.kind}`
    const existing = clusters.get(key)
    if (existing) {
      existing.count += 1
      existing.latestTs = event.ts > existing.latestTs ? event.ts : existing.latestTs
      if (!existing.route && event.route) existing.route = event.route
      if (!existing.file && event.file) existing.file = event.file
      if (!existing.requestId && event.requestId) existing.requestId = event.requestId
      if (!existing.traceId && event.traceId) existing.traceId = event.traceId
      if (!existing.codes.includes(event.code ?? "") && event.code) existing.codes.push(event.code)
      if (!existing.messages.includes(event.message)) existing.messages.push(event.message)
      continue
    }
    clusters.set(key, {
      key,
      count: 1,
      kind: event.kind,
      latestTs: event.ts,
      route: event.route,
      file: event.file,
      requestId: event.requestId,
      traceId: event.traceId,
      messages: [event.message],
      codes: event.code ? [event.code] : [],
    })
  }

  return [...clusters.values()]
    .sort((a, b) => b.count - a.count || (a.latestTs < b.latestTs ? 1 : -1))
    .slice(0, 10)
}

function buildArtifactRegressions(events: AIEvent[]): AIHealthReport["artifactRegressions"] {
  const groups = new Map<string, AIHealthReport["artifactRegressions"][number]>()

  for (const event of events) {
    const phase = getArtifactPhase(event)
    if (!phase) continue
    const path = typeof event.data?.artifact === "string" ? event.data.artifact : undefined
    const version = typeof event.data?.version === "string" ? event.data.version : undefined
    const key = `${phase}:${path ?? version ?? "default"}`
    const status = getArtifactStatus(event)
    const existing = groups.get(key)
    if (existing) {
      if (status === "error") existing.errors += 1
      if (status === "warn") existing.warnings += 1
      if (status === "success") existing.successes += 1
      existing.latestTs = event.ts > existing.latestTs ? event.ts : existing.latestTs
      existing.latestStatus = event.ts >= existing.latestTs ? status : existing.latestStatus
      if (!existing.path && path) existing.path = path
      if (!existing.version && version) existing.version = version
      if (!existing.messages.includes(event.message)) existing.messages.push(event.message)
      continue
    }
    groups.set(key, {
      key,
      phase,
      path,
      version,
      errors: status === "error" ? 1 : 0,
      warnings: status === "warn" ? 1 : 0,
      successes: status === "success" ? 1 : 0,
      latestTs: event.ts,
      latestStatus: status,
      messages: [event.message],
    })
  }

  return [...groups.values()]
    .filter((entry) => entry.errors > 0 || entry.warnings > 0)
    .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || (a.latestTs < b.latestTs ? 1 : -1))
    .slice(0, 10)
}

function getArtifactPhase(event: AIEvent): string | null {
  if (event.kind.startsWith("release.")) return event.kind.split(".").slice(0, 2).join(".")
  if (event.kind.startsWith("deploy.")) return "deploy"
  if (event.kind.startsWith("build.")) return "build"
  return null
}

function getArtifactStatus(event: AIEvent): "error" | "warn" | "success" | "info" {
  if (event.severity === "error" || event.kind.endsWith(".error")) return "error"
  if (event.severity === "warn") return "warn"
  if (event.kind.endsWith(".finish") || event.kind === "build.summary") return "success"
  return "info"
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8")
  } catch {
    return null
  }
}
