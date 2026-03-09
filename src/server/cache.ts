// Route-level response cache with stale-while-revalidate
// Usage: export const cache = { maxAge: 60, staleWhileRevalidate: 300 }

import type { MiddlewareFn } from "./middleware.ts"
import { emitAIEvent } from "../ai/index.ts"

export type CacheMode = "private" | "public" | "shared" | "no-store"

export interface CacheOptions {
  maxAge: number               // fresh cache TTL in seconds
  staleWhileRevalidate?: number // serve stale while revalidating (seconds)
  mode?: CacheMode
  vary?: string[]              // cache key varies by these headers
  includeAuthHeaders?: boolean // vary by Cookie/Authorization unless explicitly disabled
  key?: (url: URL) => string   // custom cache key generator
  store?: CacheStore
}

type Awaitable<T> = T | Promise<T>

export interface CacheEntry {
  body: string
  headers: Record<string, string>
  status: number
  createdAt: number
  revalidating?: boolean
}

export interface CacheStore {
  get(key: string): Awaitable<CacheEntry | undefined>
  set(key: string, entry: CacheEntry): Awaitable<void>
  delete(key: string): Awaitable<void>
  clear(): Awaitable<void>
  keys(): Awaitable<Iterable<string> | AsyncIterable<string>>
}

export function createMemoryCacheStore(): CacheStore {
  const store = new Map<string, CacheEntry>()
  return {
    get: (key) => store.get(key),
    set: (key, entry) => { store.set(key, entry) },
    delete: (key) => { store.delete(key) },
    clear: () => { store.clear() },
    keys: () => store.keys(),
  }
}

const defaultCacheStore = createMemoryCacheStore()
const DEFAULT_AUTH_VARY = ["Cookie", "Authorization"]
const DEFAULT_SURFACE_VARY = ["Accept", "X-Gorsee-Navigate"]

export function resolveCacheMode(options: CacheOptions): CacheMode {
  if (options.mode) return options.mode
  if (options.includeAuthHeaders === false) return "public"
  return "private"
}

export function shouldIncludeAuthHeadersForCache(options: CacheOptions, mode = resolveCacheMode(options)): boolean {
  if (typeof options.includeAuthHeaders === "boolean") return options.includeAuthHeaders
  return mode === "private"
}

function buildKey(url: URL, vary: string[], request: Request, customKey?: (url: URL) => string): string {
  const base = customKey ? customKey(url) : url.pathname + url.search
  if (vary.length === 0) return base
  const varyParts = vary.map((h) => `${h}=${request.headers.get(h) ?? ""}`).join("&")
  return `${base}?__vary=${varyParts}`
}

export function routeCache(options: CacheOptions): MiddlewareFn {
  const {
    maxAge,
    staleWhileRevalidate = 0,
    vary = [],
    key: customKey,
    store = defaultCacheStore,
  } = options
  const mode = resolveCacheMode(options)
  const includeAuthHeaders = shouldIncludeAuthHeadersForCache(options, mode)
  const normalizedVary = normalizeVaryHeaders([
    ...DEFAULT_SURFACE_VARY,
    ...(includeAuthHeaders ? DEFAULT_AUTH_VARY : []),
    ...vary,
  ])

  return async (ctx, next) => {
    if (ctx.request.method !== "GET") return next()
    if (mode === "no-store") {
      const response = await next()
      const headers = new Headers(response.headers)
      headers.set("Cache-Control", "no-store")
      setVaryHeaderObject(headers, normalizedVary)
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    const cacheKey = buildKey(ctx.url, normalizedVary, ctx.request, customKey)
    const entry = await store.get(cacheKey)
    const now = Date.now()

    if (entry) {
      const age = (now - entry.createdAt) / 1000
      if (age < maxAge) {
        void emitAIEvent({
          kind: "cache.hit",
          severity: "info",
          source: "runtime",
          message: "cache hit",
          requestId: typeof ctx.locals.requestId === "string" ? ctx.locals.requestId : undefined,
          traceId: typeof ctx.locals.traceId === "string" ? ctx.locals.traceId : undefined,
          spanId: typeof ctx.locals.spanId === "string" ? ctx.locals.spanId : undefined,
          route: ctx.url.pathname,
          data: { cacheKey, ageSeconds: Math.floor(age), mode },
        })
        return new Response(entry.body, {
          status: entry.status,
          headers: withVaryHeaders(entry.headers, normalizedVary, {
            "X-Cache": "HIT",
            "Age": String(Math.floor(age)),
          }),
        })
      }
      if (age < maxAge + staleWhileRevalidate && !entry.revalidating) {
        entry.revalidating = true
        void emitAIEvent({
          kind: "cache.stale",
          severity: "warn",
          source: "runtime",
          message: "stale cache entry served",
          requestId: typeof ctx.locals.requestId === "string" ? ctx.locals.requestId : undefined,
          traceId: typeof ctx.locals.traceId === "string" ? ctx.locals.traceId : undefined,
          spanId: typeof ctx.locals.spanId === "string" ? ctx.locals.spanId : undefined,
          route: ctx.url.pathname,
          data: { cacheKey, ageSeconds: Math.floor(age), mode },
        })
        revalidate(cacheKey, store, next)
        return new Response(entry.body, {
          status: entry.status,
          headers: withVaryHeaders(entry.headers, normalizedVary, {
            "X-Cache": "STALE",
            "Age": String(Math.floor(age)),
          }),
        })
      }
    }

    void emitAIEvent({
      kind: "cache.miss",
      severity: "info",
      source: "runtime",
      message: "cache miss",
      requestId: typeof ctx.locals.requestId === "string" ? ctx.locals.requestId : undefined,
      traceId: typeof ctx.locals.traceId === "string" ? ctx.locals.traceId : undefined,
      spanId: typeof ctx.locals.spanId === "string" ? ctx.locals.spanId : undefined,
      route: ctx.url.pathname,
      data: { cacheKey, mode },
    })
    const response = await next()
    if (response.status === 200 && isCacheableResponse(response, mode)) {
      const body = await response.text()
      const headers: Record<string, string> = {}
      response.headers.forEach((v, k) => { headers[k] = v })
      setVaryHeader(headers, normalizedVary)
      setCacheControlHeader(headers, mode, maxAge, staleWhileRevalidate)
      await store.set(cacheKey, { body, headers, status: response.status, createdAt: now })
      return new Response(body, {
        status: response.status,
        headers: { ...headers, "X-Cache": "MISS" },
      })
    }
    void emitAIEvent({
      kind: "cache.skip",
      severity: "debug",
      source: "runtime",
      message: "response not cached",
      requestId: typeof ctx.locals.requestId === "string" ? ctx.locals.requestId : undefined,
      traceId: typeof ctx.locals.traceId === "string" ? ctx.locals.traceId : undefined,
      spanId: typeof ctx.locals.spanId === "string" ? ctx.locals.spanId : undefined,
      route: ctx.url.pathname,
      data: { cacheKey, status: response.status, mode },
    })
    return response
  }
}

async function revalidate(key: string, store: CacheStore, next: () => Promise<Response>): Promise<void> {
  try {
    const response = await next()
    if (response.status === 200) {
      const body = await response.text()
      const headers: Record<string, string> = {}
      response.headers.forEach((v, k) => { headers[k] = v })
      await store.set(key, { body, headers, status: response.status, createdAt: Date.now() })
    }
  } catch {
    const entry = await store.get(key)
    if (entry) entry.revalidating = false
  }
}

export async function invalidateCache(path: string): Promise<void> {
  const keys = await defaultCacheStore.keys()
  for await (const key of keys) {
    if (key.startsWith(path)) await defaultCacheStore.delete(key)
  }
}

export async function clearCache(): Promise<void> {
  await defaultCacheStore.clear()
}

function normalizeVaryHeaders(headers: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const header of headers) {
    const trimmed = header.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(canonicalizeHeaderName(trimmed))
  }
  normalized.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  return normalized
}

function setVaryHeader(headers: Record<string, string>, vary: string[]): void {
  if (vary.length === 0) return
  const existing = headers["vary"] ?? headers["Vary"]
  const merged = normalizeVaryHeaders([
    ...(existing ? existing.split(",") : []),
    ...vary,
  ])
  headers.Vary = merged.join(", ")
  delete headers.vary
}

function setVaryHeaderObject(headers: Headers, vary: string[]): void {
  if (vary.length === 0) return
  const existing = headers.get("Vary")
  const merged = normalizeVaryHeaders([
    ...(existing ? existing.split(",") : []),
    ...vary,
  ])
  headers.set("Vary", merged.join(", "))
}

function withVaryHeaders(
  headers: Record<string, string>,
  vary: string[],
  extraHeaders: Record<string, string>,
): Record<string, string> {
  const merged = { ...headers, ...extraHeaders }
  setVaryHeader(merged, vary)
  return merged
}

function isCacheableResponse(response: Response, mode: CacheMode): boolean {
  if (response.headers.has("Set-Cookie")) return false
  const cacheControl = response.headers.get("Cache-Control")?.toLowerCase() ?? ""
  if (cacheControl.includes("no-store")) return false
  if (mode === "public" || mode === "shared") return !cacheControl.includes("private")
  return true
}

function setCacheControlHeader(
  headers: Record<string, string>,
  mode: CacheMode,
  maxAge: number,
  staleWhileRevalidate: number,
): void {
  if (mode === "no-store") {
    headers["Cache-Control"] = "no-store"
    return
  }

  const directives = [mode === "private" ? "private" : "public", `max-age=${maxAge}`]
  if (mode === "shared") directives.push(`s-maxage=${maxAge}`)
  if (staleWhileRevalidate > 0) directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
  headers["Cache-Control"] = directives.join(", ")
}

function canonicalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .split("-")
    .map((segment) => segment ? segment[0]!.toUpperCase() + segment.slice(1) : segment)
    .join("-")
}
