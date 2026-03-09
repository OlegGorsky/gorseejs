// CORS middleware — configurable Cross-Origin Resource Sharing

import type { MiddlewareFn } from "../server/middleware.ts"

export interface CORSOptions {
  origin?: string | string[] | ((origin: string) => boolean)
  methods?: string[]
  allowHeaders?: string[]
  exposeHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"]
const DEFAULT_HEADERS = ["Content-Type", "Authorization", "X-Requested-With"]

function isOriginAllowed(origin: string, allowed: CORSOptions["origin"]): boolean {
  if (!allowed) return false
  if (allowed === "*") return true
  if (typeof allowed === "string") return origin === allowed
  if (Array.isArray(allowed)) return allowed.includes(origin)
  if (typeof allowed === "function") return allowed(origin)
  return false
}

export function cors(options: CORSOptions = {}): MiddlewareFn {
  const {
    origin = "*",
    methods = DEFAULT_METHODS,
    allowHeaders = DEFAULT_HEADERS,
    exposeHeaders = [],
    credentials = false,
    maxAge = 86400,
  } = options

  return async (ctx, next) => {
    const requestOrigin = ctx.request.headers.get("origin") ?? ""

    // Preflight
    if (ctx.request.method === "OPTIONS") {
      const headers = new Headers()

      if (origin === "*" && !credentials) {
        headers.set("Access-Control-Allow-Origin", "*")
      } else if (isOriginAllowed(requestOrigin, origin)) {
        headers.set("Access-Control-Allow-Origin", requestOrigin)
        headers.set("Vary", "Origin")
      }

      headers.set("Access-Control-Allow-Methods", methods.join(", "))
      headers.set("Access-Control-Allow-Headers", allowHeaders.join(", "))
      if (exposeHeaders.length > 0) {
        headers.set("Access-Control-Expose-Headers", exposeHeaders.join(", "))
      }
      if (credentials) headers.set("Access-Control-Allow-Credentials", "true")
      headers.set("Access-Control-Max-Age", String(maxAge))

      return new Response(null, { status: 204, headers })
    }

    // Actual request
    const response = await next()

    if (origin === "*" && !credentials) {
      response.headers.set("Access-Control-Allow-Origin", "*")
    } else if (isOriginAllowed(requestOrigin, origin)) {
      response.headers.set("Access-Control-Allow-Origin", requestOrigin)
      response.headers.append("Vary", "Origin")
    }

    if (credentials) {
      response.headers.set("Access-Control-Allow-Credentials", "true")
    }
    if (exposeHeaders.length > 0) {
      response.headers.set("Access-Control-Expose-Headers", exposeHeaders.join(", "))
    }

    return response
  }
}
