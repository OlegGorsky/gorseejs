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

export function compress(): MiddlewareFn {
  return async (_ctx, next) => {
    const response = await next()
    const contentType = response.headers.get("content-type")

    if (!isCompressible(contentType)) return response
    if (response.headers.has("content-encoding")) return response
    if (!response.body) return response

    const acceptEncoding = _ctx.request.headers.get("accept-encoding") ?? ""

    if (acceptEncoding.includes("gzip")) {
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

    if (acceptEncoding.includes("deflate")) {
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
