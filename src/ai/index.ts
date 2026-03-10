import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join } from "node:path"
import {
  resolveAISessionPackConfig,
  shouldGenerateAISessionPack,
  writeAISessionPack,
  type AISessionPackConfig,
} from "./session-pack.ts"
export {
  GORSEE_AI_CONTEXT_SCHEMA_VERSION,
} from "./contracts.ts"
export {
  writeArtifactFailurePack,
  writeArtifactLifecycleEvent,
  writeArtifactSuccessPack,
  runArtifactLifecycleStep,
  type ArtifactLifecycleEventInput,
} from "./artifact-lifecycle.ts"
export {
  createAIBridgeHandler,
  createAIBridgeServer,
  type AIBridgeHandler,
  type AIBridgeServer,
  type AIBridgeServerOptions,
  type AIBridgeSnapshot,
} from "./bridge.ts"
export {
  buildAIHealthReport,
  readAIDiagnosticsSnapshot,
  readReactiveTraceArtifact,
  readAIEvents,
  resolveAIStorePaths,
  type AIHealthReport,
  type AIStorePaths,
} from "./store.ts"
export {
  createAIMCPServer,
  createLineReader,
  type AIMCPServerOptions,
} from "./mcp.ts"
export {
  createAIContextPacket,
  createAIDeploySummary,
  createAIIncidentBrief,
  createAIIncidentSnapshot,
  createAIReleaseBrief,
  renderAIDeploySummaryMarkdown,
  renderAIIncidentBriefMarkdown,
  renderAIIncidentSnapshotMarkdown,
  renderAIContextMarkdown,
  renderAIReleaseBriefMarkdown,
  type AIContextPacket,
  type AIDeploySummary,
  type AIIncidentBrief,
  type AIIncidentSnapshot,
  type AIReleaseBrief,
} from "./summary.ts"
export {
  buildAIContextBundle,
  renderAIContextBundleMarkdown,
  type AIContextBundle,
  type AIContextSnippet,
} from "./bundle.ts"
export {
  buildAIFrameworkPacket,
  renderAIFrameworkMarkdown,
  type AIFrameworkDocRef,
  type AIFrameworkPacket,
} from "./framework-context.ts"
export {
  buildIDEProjection,
  resolveIDEProjectionPaths,
  writeIDEProjection,
  type IDEProjection,
  type IDEProjectionPaths,
} from "./ide.ts"
export {
  createIDEProjectionWatcher,
  type IDEProjectionWatcher,
  type IDEProjectionWatcherOptions,
} from "./watch.ts"
export {
  resolveAISessionPackConfig,
  resolveAISessionPackPaths,
  shouldGenerateAISessionPack,
  writeAISessionPack,
  type AISessionPackConfig,
  type AISessionPackPaths,
} from "./session-pack.ts"

export type AIEventSeverity = "debug" | "info" | "warn" | "error"
export type AIEventSource = "runtime" | "build" | "cli" | "check" | "deploy" | "dev" | "log"
export type AIAppMode = "frontend" | "fullstack" | "server"
export type AIRuntimeTopology = "single-instance" | "multi-instance"

export interface AIAppContext {
  mode: AIAppMode
  runtimeTopology: AIRuntimeTopology
}

export interface AITraceContext {
  requestId?: string
  traceId: string
  spanId: string
  parentSpanId?: string
}

export interface AIDiagnostic {
  code: string
  message: string
  severity: Exclude<AIEventSeverity, "debug">
  source: AIEventSource
  file?: string
  line?: number
  route?: string
  fix?: string
  ts: string
  app?: AIAppContext
}

export interface AIEvent {
  id: string
  kind: string
  severity: AIEventSeverity
  ts: string
  source: AIEventSource
  message: string
  route?: string
  requestId?: string
  traceId?: string
  spanId?: string
  parentSpanId?: string
  phase?: string
  code?: string
  durationMs?: number
  file?: string
  line?: number
  tags?: string[]
  data?: Record<string, unknown>
  app?: AIAppContext
}

export interface AIBridgeConfig {
  url: string
  headers?: Record<string, string>
  timeoutMs?: number
  events?: string[]
}

export interface AIObservabilityConfig {
  enabled?: boolean
  jsonlPath?: string
  diagnosticsPath?: string
  redactKeys?: string[]
  sessionId?: string
  bridge?: AIBridgeConfig
  sessionPack?: AISessionPackConfig
  app?: AIAppContext
}

const DEFAULT_REDACT_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-gorsee-csrf",
  "token",
  "secret",
  "password",
  "apiKey",
  "api_key",
]

let currentConfig: Required<Pick<AIObservabilityConfig, "enabled">> & AIObservabilityConfig = {
  enabled: false,
}
let sessionPackTimer: ReturnType<typeof setTimeout> | undefined

export function configureAIObservability(config: AIObservabilityConfig = {}): void {
  currentConfig = {
    ...config,
    enabled: config.enabled ?? false,
  }
}

export function getAIObservabilityConfig(): AIObservabilityConfig {
  return currentConfig
}

export function isAIObservabilityEnabled(): boolean {
  return currentConfig.enabled === true
}

export async function emitAIEvent(
  input: Omit<AIEvent, "id" | "ts"> & { ts?: string; id?: string },
): Promise<void> {
  if (!isAIObservabilityEnabled()) return

  const event: AIEvent = {
    id: input.id ?? crypto.randomUUID(),
    ts: input.ts ?? new Date().toISOString(),
    ...input,
    app: input.app ?? currentConfig.app,
    data: redactValue(input.data, currentConfig.redactKeys ?? DEFAULT_REDACT_KEYS) as Record<string, unknown> | undefined,
  }

  const writes: Promise<unknown>[] = []
  if (currentConfig.jsonlPath) writes.push(writeJSONL(currentConfig.jsonlPath, event))
  if (currentConfig.diagnosticsPath && shouldPersistDiagnostic(event)) {
    writes.push(writeDiagnosticsSnapshot(currentConfig.diagnosticsPath, event))
  }
  if (currentConfig.bridge && shouldForwardEvent(event, currentConfig.bridge)) {
    writes.push(postBridgeEvent(currentConfig.bridge, event))
  }
  await Promise.allSettled(writes)
  scheduleSessionPack(event)
}

export async function emitAIDiagnostic(
  input: Omit<AIDiagnostic, "ts"> & { ts?: string; requestId?: string; traceId?: string; spanId?: string },
): Promise<void> {
  await emitAIEvent({
    kind: "diagnostic.issue",
    severity: input.severity,
    source: input.source,
    message: input.message,
    code: input.code,
    file: input.file,
    line: input.line,
    route: input.route,
    requestId: input.requestId,
    traceId: input.traceId,
    spanId: input.spanId,
    ts: input.ts,
    data: input.fix ? { fix: input.fix } : undefined,
  })
}

export function createTraceIds(parent?: Partial<AITraceContext>): AITraceContext {
  return {
    requestId: parent?.requestId ?? crypto.randomUUID(),
    traceId: parent?.traceId ?? crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    parentSpanId: parent?.spanId,
  }
}

export async function runWithAITrace<T>(
  input: Omit<AIEvent, "id" | "ts" | "kind"> & {
    kind: string
    trace?: Partial<AITraceContext>
  },
  fn: (trace: AITraceContext) => Promise<T>,
): Promise<T> {
  const trace = createTraceIds(input.trace)
  const startedAt = performance.now()
  await emitAIEvent({
    ...input,
    kind: `${input.kind}.start`,
    requestId: trace.requestId,
    traceId: trace.traceId,
    spanId: trace.spanId,
    parentSpanId: trace.parentSpanId,
  })

  try {
    const result = await fn(trace)
    await emitAIEvent({
      ...input,
      kind: `${input.kind}.finish`,
      requestId: trace.requestId,
      traceId: trace.traceId,
      spanId: trace.spanId,
      parentSpanId: trace.parentSpanId,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
    })
    return result
  } catch (error) {
    await emitAIEvent({
      ...input,
      kind: `${input.kind}.error`,
      severity: "error",
      requestId: trace.requestId,
      traceId: trace.traceId,
      spanId: trace.spanId,
      parentSpanId: trace.parentSpanId,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      data: {
        ...(input.data ?? {}),
        error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      },
    })
    throw error
  }
}

export function resolveAIObservabilityConfig(
  cwd: string,
  config?: AIObservabilityConfig,
): AIObservabilityConfig {
  const enabled = config?.enabled ?? false
  const resolvedJsonlPath = config?.jsonlPath
    ? resolvePath(cwd, config.jsonlPath)
    : join(cwd, ".gorsee", "ai-events.jsonl")
  const resolvedDiagnosticsPath = config?.diagnosticsPath
    ? resolvePath(cwd, config.diagnosticsPath)
    : join(cwd, ".gorsee", "ai-diagnostics.json")
  return {
    ...config,
    enabled,
    jsonlPath: enabled ? resolvedJsonlPath : config?.jsonlPath,
    diagnosticsPath: enabled
      ? resolvedDiagnosticsPath
      : config?.diagnosticsPath,
    sessionPack: enabled ? resolveAISessionPackConfig(cwd, config?.sessionPack) : config?.sessionPack,
  }
}

export function __resetAIObservability(): void {
  currentConfig = { enabled: false }
  if (sessionPackTimer) clearTimeout(sessionPackTimer)
  sessionPackTimer = undefined
}

function shouldForwardEvent(event: AIEvent, bridge: AIBridgeConfig): boolean {
  if (!bridge.events || bridge.events.length === 0) return true
  return bridge.events.includes(event.kind)
}

async function writeJSONL(path: string, event: AIEvent): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf-8")
}

async function writeDiagnosticsSnapshot(path: string, event: AIEvent): Promise<void> {
  const snapshot = {
    updatedAt: event.ts,
    sessionId: currentConfig.sessionId,
    app: event.app,
    latest: {
      code: event.code,
      message: event.message,
      severity: event.severity,
      source: event.source,
      file: event.file,
      line: event.line,
      route: event.route,
      requestId: event.requestId,
      traceId: event.traceId,
      spanId: event.spanId,
      app: event.app,
    },
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(snapshot, null, 2), "utf-8")
}

async function postBridgeEvent(bridge: AIBridgeConfig, event: AIEvent): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), bridge.timeoutMs ?? 300)
  try {
    await fetch(bridge.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bridge.headers ?? {}),
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    })
  } catch {
    // IDE bridge failures must never affect app/runtime behavior.
  } finally {
    clearTimeout(timeout)
  }
}

function redactValue(value: unknown, redactKeys: string[]): unknown {
  if (value == null) return value
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}...[truncated]` : value
  if (Array.isArray(value)) return value.map((item) => redactValue(item, redactKeys))
  if (typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const shouldRedact = redactKeys.some((candidate) => candidate.toLowerCase() === key.toLowerCase())
      result[key] = shouldRedact ? "[redacted]" : redactValue(nestedValue, redactKeys)
    }
    return result
  }
  return value
}

function shouldPersistDiagnostic(event: AIEvent): boolean {
  return event.kind === "diagnostic.issue" || event.severity === "error" || event.code?.startsWith("E") === true
}

function resolvePath(cwd: string, path: string): string {
  return isAbsolute(path) ? path : join(cwd, path)
}

function scheduleSessionPack(event: AIEvent): void {
  const config = currentConfig.sessionPack
  if (!currentConfig.enabled || !config) return

  if (!shouldGenerateAISessionPack(event, config)) return
  if (!currentConfig.jsonlPath || !currentConfig.diagnosticsPath) return

  const cwd = dirname(dirname(currentConfig.jsonlPath))
  if (sessionPackTimer) clearTimeout(sessionPackTimer)
  sessionPackTimer = setTimeout(() => {
    sessionPackTimer = undefined
    void writeAISessionPack(cwd, {
      eventsPath: currentConfig.jsonlPath!,
      diagnosticsPath: currentConfig.diagnosticsPath!,
      reactiveTracePath: join(cwd, ".gorsee", "reactive-trace.json"),
    }, config).catch(() => {
      // Session-pack generation is best-effort and must never fail the caller/test path.
    })
  }, config.debounceMs ?? 250)
}
