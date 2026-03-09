import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { createAIContextPacket, renderAIContextMarkdown, type AIContextPacket } from "./summary.ts"
import { buildAIHealthReport, readAIDiagnosticsSnapshot, readAIEvents, readReactiveTraceArtifact, type AIStorePaths } from "./store.ts"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "./contracts.ts"

export interface IDEProjectionPaths {
  diagnosticsPath: string
  eventsPath: string
  contextPath: string
}

export interface IDEProjection {
  schemaVersion: string
  updatedAt: string
  diagnostics: Array<{
    code?: string
    message: string
    severity: string
    file?: string
    line?: number
    route?: string
  }>
  recentEvents: Array<{
    kind: string
    severity: string
    message: string
    ts: string
    route?: string
    file?: string
    line?: number
    artifact?: string
    version?: string
  }>
  artifactRegressions: AIContextPacket["artifactRegressions"]
  context: AIContextPacket
}

export function resolveIDEProjectionPaths(cwd: string): IDEProjectionPaths {
  const base = join(cwd, ".gorsee", "ide")
  return {
    diagnosticsPath: join(base, "diagnostics.json"),
    eventsPath: join(base, "events.json"),
    contextPath: join(base, "context.md"),
  }
}

export async function buildIDEProjection(
  storePaths: AIStorePaths,
  options: { limit?: number } = {},
): Promise<IDEProjection> {
  const events = await readAIEvents(storePaths.eventsPath, { limit: options.limit ?? 100 })
  const diagnosticsSnapshot = await readAIDiagnosticsSnapshot(storePaths.diagnosticsPath)
  const reactiveTrace = await readReactiveTraceArtifact(storePaths.reactiveTracePath)
  const report = await buildAIHealthReport(storePaths, { limit: options.limit ?? 200 })
  const context = createAIContextPacket(report, events, diagnosticsSnapshot?.latest, reactiveTrace)

  return {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    diagnostics: diagnosticsSnapshot?.latest
      ? [{
          code: diagnosticsSnapshot.latest.code,
          message: diagnosticsSnapshot.latest.message ?? "",
          severity: diagnosticsSnapshot.latest.severity ?? "error",
          file: diagnosticsSnapshot.latest.file,
          line: diagnosticsSnapshot.latest.line,
          route: diagnosticsSnapshot.latest.route,
        }]
      : [],
    recentEvents: events.slice(-20).reverse().map((event) => ({
      kind: event.kind,
      severity: event.severity,
      message: event.message,
      ts: event.ts,
      route: event.route,
      file: event.file,
      line: event.line,
      artifact: typeof event.data?.artifact === "string" ? event.data.artifact : undefined,
      version: typeof event.data?.version === "string" ? event.data.version : undefined,
    })),
    artifactRegressions: context.artifactRegressions,
    context,
  }
}

export async function writeIDEProjection(
  projectionPaths: IDEProjectionPaths,
  projection: IDEProjection,
): Promise<void> {
  await mkdir(dirname(projectionPaths.diagnosticsPath), { recursive: true })
  await writeFile(projectionPaths.diagnosticsPath, JSON.stringify({
    schemaVersion: projection.schemaVersion,
    updatedAt: projection.updatedAt,
    diagnostics: projection.diagnostics,
  }, null, 2), "utf-8")
  await writeFile(projectionPaths.eventsPath, JSON.stringify({
    schemaVersion: projection.schemaVersion,
    updatedAt: projection.updatedAt,
    events: projection.recentEvents,
    artifactRegressions: projection.artifactRegressions,
  }, null, 2), "utf-8")
  await writeFile(projectionPaths.contextPath, renderAIContextMarkdown(projection.context), "utf-8")
}
