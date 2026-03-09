// ETag support for static file serving
// Generates weak ETags based on file size + modification time

import { stat } from "node:fs/promises"

export function generateETag(size: number, mtimeMs: number): string {
  return `W/"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`
}

export async function fileETag(filePath: string): Promise<string | null> {
  try {
    const s = await stat(filePath)
    return generateETag(s.size, s.mtimeMs)
  } catch {
    return null
  }
}

export function isNotModified(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get("if-none-match")
  if (!ifNoneMatch) return false
  return ifNoneMatch.split(",").some((t) => t.trim() === etag)
}
