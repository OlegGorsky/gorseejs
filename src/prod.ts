// Gorsee.js Production Server
// Serves pre-built client bundles + SSR pages from dist/

import { createRouter, matchRoute, buildStaticMap } from "./router/index.ts"
import { securityHeaders } from "./security/headers.ts"
import { createRateLimiter } from "./security/rate-limit.ts"
import type { MiddlewareFn } from "./server/middleware.ts"
import { compress } from "./server/compress.ts"
import { log, setLogLevel } from "./log/index.ts"
import { loadEnv } from "./env/index.ts"
import { generateNonce, wrapHTML } from "./server/html-shell.ts"
import { renderNotFoundPage } from "./server/not-found.ts"
import { createRateLimitResponse, handleRPCWithHeaders } from "./server/request-preflight.ts"
import {
  createClientScriptPath,
} from "./server/page-render.ts"
import { createRequestSecurityPolicy } from "./server/request-security-policy.ts"
import {
  renderRoutePageResponse,
  renderRoutePartialResponse,
} from "./server/route-response.ts"
import { handleRouteRequest } from "./server/route-request.ts"
import { dispatchRuntimeRequestPlan } from "./server/runtime-dispatch.ts"
import { createRuntimeRequestPlan } from "./server/request-surface.ts"
import { servePrefixedStaticFile, serveStaticFile } from "./server/static-file.ts"
import {
  BUILD_MANIFEST_SCHEMA_VERSION,
  getClientBundleForRoute,
  getPrerenderedHtmlPath,
  isPrerenderedRoute,
  loadBuildManifest,
} from "./server/manifest.ts"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { join } from "node:path"
import { Readable } from "node:stream"
import { createProjectContext, resolveRuntimeEnv, type RuntimeOptions } from "./runtime/project.ts"
import {
  loadAppConfig,
  resolveAIConfig,
  resolveRuntimeTopology,
  resolveRPCMiddlewares,
  resolveSecurityRateLimit,
  resolveTrustedHosts,
  resolveTrustedForwardedHops,
  resolveTrustedOrigin,
  resolveTrustForwardedHeaders,
} from "./runtime/app-config.ts"
import {
  configureAIObservability,
  createTraceIds,
  emitAIEvent,
  type AIObservabilityConfig,
} from "./ai/index.ts"
// Route type used implicitly via createRouter return

interface StartProductionServerOptions extends RuntimeOptions {
  port?: number
  registerSignalHandlers?: boolean
  rpcMiddlewares?: MiddlewareFn[]
  ai?: AIObservabilityConfig
}

export interface NodeProductionServer {
  port: number
  stop(): Promise<void>
}

interface ProductionRuntimeState {
  cwd: string
  routesDir: string
  publicDir: string
  distDir: string
  clientDir: string
  appConfigFile: string
  manifest: Awaited<ReturnType<typeof loadBuildManifest>>
  routes: Awaited<ReturnType<typeof createRouter>>
  staticMap: ReturnType<typeof buildStaticMap>
  rateLimiter: {
    check(key: string): { allowed: boolean; remaining: number; resetAt: number } | Promise<{ allowed: boolean; remaining: number; resetAt: number }>
  }
  compressMiddleware: ReturnType<typeof compress>
}

function requireTrustedOrigin(trustedOrigin: string | undefined): string {
  if (!trustedOrigin) {
    throw new Error(
      "Missing trusted origin for production runtime. Set security.origin in app.config.ts or APP_ORIGIN in the environment.",
    )
  }
  return trustedOrigin
}

async function tryServeStatic(
  pathname: string,
  request: Request,
  publicDir: string,
  clientDir: string,
  secHeaders: Record<string, string>,
): Promise<Response | null> {
  if (pathname === "/") return null
  // Client assets from dist/
  const bundleResponse = await servePrefixedStaticFile(pathname, "/_gorsee/", clientDir, {
    contentType: "application/javascript",
    cacheControl: "public, max-age=31536000, immutable",
    extraHeaders: secHeaders,
  })
  if (bundleResponse) return bundleResponse

  // Public files
  return serveStaticFile(publicDir, pathname.slice(1), {
    request,
    etag: true,
    cacheControl: "public, max-age=3600",
    extraHeaders: secHeaders,
  })
}

async function tryServePrerenderedPage(
  pathname: string,
  request: Request,
  manifest: Awaited<ReturnType<typeof loadBuildManifest>>,
  distDir: string,
  secHeaders: Record<string, string>,
): Promise<Response | null> {
  if (request.method !== "GET") return null
  if (!isPrerenderedRoute(manifest, pathname)) return null

  return serveStaticFile(join(distDir, "static"), getPrerenderedHtmlPath(pathname), {
    request,
    etag: true,
    cacheControl: "public, max-age=3600",
    contentType: "text/html; charset=utf-8",
    extraHeaders: secHeaders,
  })
}

export async function startProductionServer(options: StartProductionServerOptions = {}) {
  const runtime = createProjectContext(options)
  const registerSignalHandlers = options.registerSignalHandlers ?? true

  await loadEnv(runtime.cwd)
  const envConfig = resolveRuntimeEnv(process.env)
  const port = options.port ?? envConfig.port
  const fetchHandler = await createProductionFetchHandler({
    cwd: runtime.cwd,
    env: process.env,
    rpcMiddlewares: options.rpcMiddlewares,
    ai: options.ai,
    pathOverrides: options.pathOverrides,
  })
  log.info("production server starting", { cwd: runtime.cwd })

  const server = Bun.serve({
    port,
    fetch: fetchHandler,
  })

  log.info("production server started", { url: `http://localhost:${server.port}` })

  // Graceful shutdown
  if (registerSignalHandlers) {
    const shutdown = () => {
      log.info("shutting down...")
      server.stop(true) // close existing connections gracefully
      process.exit(0)
    }
    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)
  }

  return server
}

export async function startNodeProductionServer(
  options: StartProductionServerOptions = {},
): Promise<NodeProductionServer> {
  const runtime = createProjectContext(options)
  const registerSignalHandlers = options.registerSignalHandlers ?? true

  await loadEnv(runtime.cwd)
  const envConfig = resolveRuntimeEnv(process.env)
  const port = options.port ?? envConfig.port
  const fetchHandler = await createProductionFetchHandler({
    cwd: runtime.cwd,
    env: process.env,
    rpcMiddlewares: options.rpcMiddlewares,
    ai: options.ai,
    pathOverrides: options.pathOverrides,
  })
  log.info("node production server starting", { cwd: runtime.cwd })

  const server = createServer(async (req, res) => {
    try {
      const request = createNodeRequest(req)
      const response = await fetchHandler(request, {
        requestIP(input) {
          void input
          const address = req.socket.remoteAddress
          return address ? { address } : null
        },
      })
      await writeNodeResponse(res, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error("node production request failed", { error: message })
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
      }
      res.end("Internal Server Error")
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(port, resolve)
  })

  const address = server.address()
  const resolvedPort = typeof address === "object" && address ? address.port : port
  log.info("node production server started", { url: `http://localhost:${resolvedPort}` })

  if (registerSignalHandlers) {
    const shutdown = () => {
      log.info("shutting down node server...")
      void new Promise<void>((resolve) => server.close(() => resolve()))
        .finally(() => process.exit(0))
    }
    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)
  }

  return {
    port: resolvedPort,
    stop() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    },
  }
}

export async function createProductionFetchHandler(
  options: Pick<StartProductionServerOptions, "cwd" | "env" | "rpcMiddlewares" | "ai" | "pathOverrides"> = {},
): Promise<(request: Request, server?: { requestIP(request: Request): { address: string } | null }) => Promise<Response>> {
  const state = await loadProductionRuntimeState(options)
  const appConfig = await loadAppConfig(state.cwd, state.appConfigFile)
  const rpcMiddlewares = resolveRPCMiddlewares(appConfig, options.rpcMiddlewares)
  const trustedOrigin = requireTrustedOrigin(resolveTrustedOrigin(appConfig, options.env ?? process.env))
  const trustForwardedHeaders = resolveTrustForwardedHeaders(appConfig)
  const trustedForwardedHops = resolveTrustedForwardedHops(appConfig)
  const requestSecurityPolicy = createRequestSecurityPolicy({
    trustedOrigin,
    trustForwardedHeaders,
    trustedForwardedHops,
    trustedHosts: resolveTrustedHosts(appConfig),
  })
  configureAIObservability(resolveAIConfig(state.cwd, appConfig, options.ai))

  return async (request, server) => {
    const url = new URL(request.url)
    const pathname = url.pathname
    const trace = createTraceIds()
    const startTs = performance.now()

    await emitAIEvent({
      kind: "request.start",
      severity: "info",
      source: "runtime",
      message: "incoming production request",
      requestId: trace.requestId,
      traceId: trace.traceId,
      spanId: trace.spanId,
      data: { method: request.method, pathname },
    })

    const ip = server?.requestIP(request)?.address ?? "unknown"
    const rateLimitResponse = await createRateLimitResponse(state.rateLimiter, ip)
    if (rateLimitResponse) return rateLimitResponse

    const nonce = generateNonce()
    const secHeaders = securityHeaders({}, nonce)

    const match = matchRoute(state.routes, pathname, state.staticMap)
    const requestPlan = createRuntimeRequestPlan({
      pathname,
      hasRouteMatch: Boolean(match),
      allowPrerendered: true,
    })
    const dispatch = await dispatchRuntimeRequestPlan({
      plan: requestPlan.filter((surface) => surface !== "hmr"),
      pathname,
      request,
      trace,
      startTs,
      source: "runtime",
      route: match?.route.path,
      handlers: {
        rpc: async () => handleRPCWithHeaders(request, secHeaders, {
          middlewares: rpcMiddlewares,
          securityPolicy: requestSecurityPolicy,
        }),
        bundle: async () => tryServeStatic(pathname, request, state.publicDir, state.clientDir, secHeaders),
        static: async () => tryServeStatic(pathname, request, state.publicDir, state.clientDir, secHeaders),
        prerendered: async () => tryServePrerenderedPage(pathname, request, state.manifest, state.distDir, secHeaders),
        route: async () => {
          if (!match) return null
          await emitAIEvent({
            kind: "route.match",
            severity: "info",
            source: "runtime",
            message: "route matched",
            requestId: trace.requestId,
            traceId: trace.traceId,
            spanId: trace.spanId,
            route: match.route.path,
            data: { pathname, file: match.route.filePath },
          })

          try {
            return await handleRouteRequest({
              match,
              request,
              trace,
              extraMiddlewares: [state.compressMiddleware satisfies MiddlewareFn],
              trustedOrigin,
              trustForwardedHeaders,
              securityPolicy: requestSecurityPolicy,
              onPartialRequest: async ({ ctx, resolved }) => {
                const clientScript = createClientScriptPath(getClientBundleForRoute(state.manifest, match.route.path))
                return renderRoutePartialResponse({
                  match,
                  ctx,
                  resolved,
                  clientScript,
                  secHeaders,
                })
              },
              onPageRequest: async ({ ctx, resolved }) => {
                const clientScript = createClientScriptPath(getClientBundleForRoute(state.manifest, match.route.path))
                return renderRoutePageResponse({
                  match,
                  ctx,
                  resolved,
                  clientScript,
                  nonce,
                  secHeaders,
                  wrapHTML,
                })
              },
            })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            log.error("request error", { path: pathname, error: message })
            await emitAIEvent({
              kind: "request.error",
              severity: "error",
              source: "runtime",
              message,
              requestId: trace.requestId,
              traceId: trace.traceId,
              spanId: trace.spanId,
              route: match.route.path,
              durationMs: Number((performance.now() - startTs).toFixed(2)),
              data: { method: request.method, pathname, error: message },
            })
            return new Response(wrapHTML("<h1>500</h1><p>Internal Server Error</p>", nonce), {
              status: 500,
              headers: { "Content-Type": "text/html", ...secHeaders },
            })
          }
        },
        "not-found": async () => new Response(await renderNotFoundPage(state.routesDir, nonce), {
          status: 404,
          headers: { "Content-Type": "text/html", ...secHeaders },
        }),
      },
    })
    if (dispatch) return dispatch.response

    throw new Error(`Unhandled request plan for ${pathname}`)
  }
}

async function loadProductionRuntimeState(options: RuntimeOptions = {}): Promise<ProductionRuntimeState> {
  const runtime = createProjectContext(options)

  await loadEnv(runtime.cwd)
  const envConfig = resolveRuntimeEnv(process.env)
  setLogLevel(envConfig.logLevel)

  const appConfig = await loadAppConfig(runtime.cwd, runtime.paths.appConfigFile)
  const manifest = await loadBuildManifest(runtime.paths.distDir)
  log.info("loaded manifest", {
    routes: Object.keys(manifest.routes).length,
    built: manifest.buildTime,
    schemaVersion: manifest.schemaVersion,
    expectedSchemaVersion: BUILD_MANIFEST_SCHEMA_VERSION,
  })

  const routes = await createRouter(runtime.paths.routesDir)
  const staticMap = buildStaticMap(routes)
  const topology = resolveRuntimeTopology(appConfig)
  const configuredRateLimit = resolveSecurityRateLimit(appConfig)
  const rateLimiter = configuredRateLimit?.limiter
    ?? (topology === "multi-instance"
      ? null
      : createRateLimiter(
        configuredRateLimit?.maxRequests ?? envConfig.rateLimit,
        configuredRateLimit?.window ?? envConfig.rateWindow,
      ))

  if (!rateLimiter) {
    throw new Error(
      [
        "Multi-instance production runtime requires security.rateLimit.limiter in app.config.ts.",
        "Use a distributed limiter such as createRedisRateLimiter(...) instead of the process-local default.",
      ].join(" "),
    )
  }

  return {
    cwd: runtime.cwd,
    routesDir: runtime.paths.routesDir,
    publicDir: runtime.paths.publicDir,
    distDir: runtime.paths.distDir,
    clientDir: runtime.paths.clientDir,
    appConfigFile: runtime.paths.appConfigFile,
    manifest,
    routes,
    staticMap,
    rateLimiter,
    compressMiddleware: compress(),
  }
}

function createNodeRequest(req: IncomingMessage): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
      continue
    }
    if (typeof value === "string") headers.set(key, value)
  }

  const host = headers.get("host") ?? "127.0.0.1"
  const url = new URL(req.url ?? "/", `http://${host}`)
  const method = req.method ?? "GET"
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers })
  }

  return new Request(url, {
    method,
    headers,
    body: Readable.toWeb(req) as unknown as ReadableStream,
    duplex: "half",
  } as RequestInit & { duplex: "half" })
}

async function writeNodeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  res.statusMessage = response.statusText

  const headersWithSetCookie = response.headers as Headers & { getSetCookie?: () => string[] }
  const setCookie = headersWithSetCookie.getSetCookie?.() ?? []
  if (setCookie.length > 0) {
    res.setHeader("Set-Cookie", setCookie)
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie" && setCookie.length > 0) return
    res.setHeader(key, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  const body = Buffer.from(await response.arrayBuffer())
  res.end(body)
}
