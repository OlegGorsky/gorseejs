import { ERROR_CATALOG, type ErrorCode } from "./catalog.ts"

export class GorseeError extends Error {
  readonly code: ErrorCode
  readonly filePath?: string
  readonly line?: number

  constructor(code: ErrorCode, details?: { filePath?: string; line?: number; extra?: string }) {
    const entry = ERROR_CATALOG[code]
    const title = entry?.title ?? "Unknown error"
    super(`[GORSEE ${code}] ${title}${details?.extra ? `: ${details.extra}` : ""}`)

    this.code = code
    this.filePath = details?.filePath
    this.line = details?.line
  }
}

export interface FormattedError {
  human: string
  json: {
    code: ErrorCode
    title: string
    file?: string
    line?: number
    fix: string
  }
}

export function formatError(err: GorseeError): FormattedError {
  const entry = ERROR_CATALOG[err.code]

  const location = err.filePath
    ? `\n  ${err.filePath}${err.line ? `:${err.line}` : ""}`
    : ""

  const human = [
    `GORSEE ${err.code}: ${entry?.title ?? "Unknown"}`,
    location,
    `\n  What: ${entry?.description ?? err.message}`,
    `  Fix: ${entry?.fix ?? "See documentation"}`,
    `\n  AI context (copy entire block):`,
    `  +${"─".repeat(45)}`,
    `  | Framework: Gorsee.js`,
    `  | Error: ${err.code} - ${entry?.title}`,
    err.filePath ? `  | File: ${err.filePath}${err.line ? `:${err.line}` : ""}` : null,
    `  | Fix: ${entry?.fix}`,
    `  +${"─".repeat(45)}`,
  ]
    .filter(Boolean)
    .join("\n")

  return {
    human,
    json: {
      code: err.code,
      title: entry?.title ?? "Unknown",
      file: err.filePath,
      line: err.line,
      fix: entry?.fix ?? "See documentation",
    },
  }
}
