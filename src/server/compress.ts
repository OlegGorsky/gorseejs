// Response compression middleware — gzip/deflate
// Uses Web Streams API (native in Bun)

import type { MiddlewareFn } from "./middleware.ts"

const COMPRESSIBLE_TYPES = new Set([
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/json",
  "text/xml",
  "application/xml",
  "image/svg+xml",
])

function isCompressible(contentType: string | null): boolean {
  if (!contentType) return false
  const type = contentType.split(";")[0]!.trim()
  return COMPRESSIBLE_TYPES.has(type)
}

function parseAcceptedEncodings(header: string): Map<string, number> {
  const accepted = new Map<string, number>()
  for (const rawEntry of header.split(",")) {
    const entry = rawEntry.trim()
    if (!entry) continue
    const [rawName, ...params] = entry.split(";").map((part) => part.trim())
    const name = rawName?.toLowerCase()
    if (!name) continue
    const qParam = params.find((part) => part.startsWith("q="))
    const qValue = qParam ? Number(qParam.slice(2)) : 1
    if (!Number.isFinite(qValue)) continue
    accepted.set(name, Math.max(0, Math.min(qValue, 1)))
  }
  return accepted
}

function resolveEncoding(header: string): "gzip" | "deflate" | null {
  const acceptedEncodings = parseAcceptedEncodings(header)
  const wildcardWeight = acceptedEncodings.get("*")
  const candidates: Array<"gzip" | "deflate"> = ["gzip", "deflate"]

  let best: { encoding: "gzip" | "deflate"; weight: number } | null = null
  for (const encoding of candidates) {
    const explicitWeight = acceptedEncodings.get(encoding)
    const weight = explicitWeight ?? wildcardWeight ?? 0
    if (weight <= 0) continue
    if (!best || weight > best.weight) {
      best = { encoding, weight }
    }
  }

  return best?.encoding ?? null
}

export function compress(): MiddlewareFn {
  return async (_ctx, next) => {
    const response = await next()
    const contentType = response.headers.get("content-type")

    if (!isCompressible(contentType)) return response
    if (response.headers.has("content-encoding")) return response
    if (!response.body) return response

    const selectedEncoding = resolveEncoding(_ctx.request.headers.get("accept-encoding") ?? "")
    if (selectedEncoding === "gzip") {
      const compressed = response.body.pipeThrough(new CompressionStream("gzip"))
      const headers = new Headers(response.headers)
      headers.set("Content-Encoding", "gzip")
      headers.delete("Content-Length")
      return new Response(compressed, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    if (selectedEncoding === "deflate") {
      const compressed = response.body.pipeThrough(new CompressionStream("deflate"))
      const headers = new Headers(response.headers)
      headers.set("Content-Encoding", "deflate")
      headers.delete("Content-Length")
      return new Response(compressed, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    return response
  }
}
