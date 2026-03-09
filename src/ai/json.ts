export const MAX_AI_JSON_BYTES = 64 * 1024
export const MAX_AI_EVENTS_READ = 5000

export function safeJSONParse<T>(raw: string, options: { maxBytes?: number } = {}): T | null {
  const maxBytes = options.maxBytes ?? MAX_AI_JSON_BYTES
  if (Buffer.byteLength(raw, "utf-8") > maxBytes) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
