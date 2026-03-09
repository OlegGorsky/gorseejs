export type ClientBuildDiagnosticSeverity = "info" | "warn" | "error"
export type ClientBuildDiagnosticPhase = "resolve" | "load" | "transform" | "bundle" | "emit"

export interface ClientBuildLog {
  message: string
  backend?: string
  phase?: ClientBuildDiagnosticPhase
  severity?: ClientBuildDiagnosticSeverity
  code?: string
  file?: string
  plugin?: string
  detail?: string
}

export function normalizeClientBuildLog(
  log: ClientBuildLog,
  defaults: {
    backend: string
    phase?: ClientBuildDiagnosticPhase
    severity?: ClientBuildDiagnosticSeverity
    code?: string
  },
): ClientBuildLog {
  return {
    ...log,
    backend: log.backend ?? defaults.backend,
    phase: log.phase ?? defaults.phase ?? "bundle",
    severity: log.severity ?? defaults.severity ?? "error",
    code: log.code ?? defaults.code ?? "BUILD_BACKEND_FAILURE",
  }
}

export function formatClientBuildLog(log: ClientBuildLog): string {
  const parts = [
    `backend=${log.backend ?? "unknown"}`,
    `phase=${log.phase ?? "bundle"}`,
    `severity=${log.severity ?? "error"}`,
  ]
  if (log.code) parts.push(`code=${log.code}`)
  if (log.file) parts.push(`file=${log.file}`)
  if (log.plugin) parts.push(`plugin=${log.plugin}`)

  let line = `[${parts.join(" ")}] ${log.message}`
  if (log.detail) line += ` | ${log.detail}`
  return line
}

export function summarizeClientBuildFailure(backend: string, logs: ClientBuildLog[]): string {
  const primary = logs[0]
  if (!primary) {
    return `Client build failed in backend "${backend}" without diagnostics`
  }
  const formatted = formatClientBuildLog(primary)
  if (logs.length === 1) return `Client build failed: ${formatted}`
  return `Client build failed: ${formatted} (${logs.length - 1} more diagnostic(s))`
}
