// Gorsee.js Dev Server
// Orchestrator: routing + security + HMR + static serving

import { createRouter, matchRoute, buildStaticMap } from "./router/index.ts"
import { __resetRPCState } from "./server/rpc.ts"
import { securityHeaders } from "./security/headers.ts"
import { createRateLimiter } from "./security/rate-limit.ts"
import { EVENT_REPLAY_SCRIPT } from "./runtime/event-replay.ts"
import { log, setLogLevel } from "./log/index.ts"
import { buildClientBundles, type BuildResult } from "./build/client.ts"
import { HMR_CLIENT_SCRIPT, addHMRClient, createHMRUpdate, removeHMRClient, notifyHMRUpdate } from "./dev/hmr.ts"
import { startWatcher } from "./dev/watcher.ts"
import { renderErrorOverlay } from "./dev/error-overlay.ts"
import { handlePageRequest } from "./dev/request-handler.ts"
import { loadEnv } from "./env/index.ts"
import { generateNonce, wrapHTML } from "./server/html-shell.ts"
import { renderNotFoundPage } from "./server/not-found.ts"
import { createRateLimitResponse, handleRPCWithHeaders } from "./server/request-preflight.ts"
import { createRequestSecurityPolicy, validateRequestSecurityPolicy } from "./server/request-security-policy.ts"
import { dispatchRuntimeRequestPlan } from "./server/runtime-dispatch.ts"
import { createRuntimeRequestPlan } from "./server/request-surface.ts"
import { servePrefixedStaticFile, serveStaticFile } from "./server/static-file.ts"
import { resolveRequestExecutionPolicy, resolveRequestMetadata } from "./server/request-policy.ts"
import { join } from "node:path"
import type { Route } from "./router/index.ts"
import { createProjectContext, resolveRuntimeEnv, type RuntimeOptions } from "./runtime/project.ts"
import type { MiddlewareFn } from "./server/middleware.ts"
import {
  loadAppConfig,
  resolveAIConfig,
  resolveRPCMiddlewares,
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

interface StartDevServerOptions extends RuntimeOptions {
  port?: number
  rpcMiddlewares?: MiddlewareFn[]
  ai?: AIObservabilityConfig
}

interface DevRuntimeState {
  cwd: string
  routesDir: string
  publicDir: string
  clientDir: string
  rateLimiter: ReturnType<typeof createRateLimiter>
  routes: Route[]
  staticMap: Map<string, Route>
  clientBuild: BuildResult
}

// --- Static file serving ---

async function tryServeStatic(publicDir: string, pathname: string): Promise<Response | null> {
  if (pathname === "/") return null
  return serveStaticFile(publicDir, pathname.slice(1))
}

async function tryServeClientBundle(clientDir: string, pathname: string): Promise<Response | null> {
  return servePrefixedStaticFile(pathname, "/_gorsee/", clientDir, {
    contentType: "application/javascript",
  })
}

// --- 404 page ---

async function render404Page(routesDir: string, nonce: string): Promise<string> {
  return renderNotFoundPage(routesDir, nonce, {
    bodyPrefix: [EVENT_REPLAY_SCRIPT.replace("<script", `<script nonce="${nonce}"`)],
    bodySuffix: [HMR_CLIENT_SCRIPT.replace("<script", `<script nonce="${nonce}"`)],
  })
}

function createDevHTMLWrapper(
  body: string,
  nonce: string | undefined,
  options?: Parameters<typeof wrapHTML>[2],
): string {
  const eventReplay = EVENT_REPLAY_SCRIPT.replace("<script", `<script nonce="${nonce}"`)
  const hmrScript = HMR_CLIENT_SCRIPT.replace("<script", `<script nonce="${nonce}"`)
  return wrapHTML(body, nonce, {
    ...options,
    bodyPrefix: [...(options?.bodyPrefix ?? []), eventReplay],
    bodySuffix: [...(options?.bodySuffix ?? []), hmrScript],
  })
}

// --- Build & watch ---

async function createDevRuntimeState(cwd: string): Promise<DevRuntimeState> {
  const { paths } = createProjectContext({ cwd })
  return {
    cwd,
    routesDir: paths.routesDir,
    publicDir: paths.publicDir,
    clientDir: join(paths.gorseeDir, "client"),
    rateLimiter: createRateLimiter(200, "1m"),
    routes: [],
    staticMap: new Map(),
    clientBuild: { entryMap: new Map() },
  }
}

async function rebuildClient(state: DevRuntimeState, buildState: { inProgress: boolean, queued: boolean }) {
  if (buildState.inProgress) {
    buildState.queued = true
    return
  }
  buildState.inProgress = true
  try {
    __resetRPCState()
    state.routes = await createRouter(state.routesDir)
    state.staticMap = buildStaticMap(state.routes)
    state.clientBuild = await buildClientBundles(state.routes, state.cwd)
    log.info("client build complete", { routes: state.clientBuild.entryMap.size })
  } catch (err) {
    log.error("client build failed", { error: String(err) })
  } finally {
    buildState.inProgress = false
    if (buildState.queued) {
      buildState.queued = false
      await rebuildClient(state, buildState)
    }
  }
}

// --- Server ---

export async function startDevServer(options: StartDevServerOptions = {}) {
  const runtime = createProjectContext(options)
  const cwd = runtime.cwd
  const state = await createDevRuntimeState(cwd)
  const buildState = { inProgress: false, queued: false }

  await loadEnv(cwd)
  const appConfig = await loadAppConfig(cwd)
  const rpcMiddlewares = resolveRPCMiddlewares(appConfig, options.rpcMiddlewares)
  const trustForwardedHeaders = resolveTrustForwardedHeaders(appConfig)
  const trustedForwardedHops = resolveTrustedForwardedHops(appConfig)
  configureAIObservability(resolveAIConfig(cwd, appConfig, options.ai))
  const envConfig = resolveRuntimeEnv(process.env)
  const port = options.port ?? envConfig.port
  const trustedOrigin = resolveTrustedOrigin(appConfig, process.env) ?? `http://localhost:${port}`
  const requestSecurityPolicy = createRequestSecurityPolicy({
    trustedOrigin,
    trustForwardedHeaders,
    trustedForwardedHops,
    trustedHosts: resolveTrustedHosts(appConfig),
  })
  setLogLevel(envConfig.logLevel)
  log.info("scanning routes", { dir: state.routesDir })

  state.routes = await createRouter(state.routesDir)
  state.staticMap = buildStaticMap(state.routes)
  for (const route of state.routes) {
    log.info("route registered", { path: route.path, file: route.filePath })
  }

  await rebuildClient(state, buildState)

  startWatcher({
    dirs: [state.routesDir, runtime.paths.sharedDir, runtime.paths.middlewareDir],
    onChange: async (changedPath) => {
      await rebuildClient(state, buildState)
      notifyHMRUpdate(createHMRUpdate({
        changedPath,
        routesDir: state.routesDir,
        sharedDir: runtime.paths.sharedDir,
        middlewareDir: runtime.paths.middlewareDir,
        routes: state.routes,
        clientBuild: state.clientBuild,
      }))
    },
  })

  const server = Bun.serve({
    port,
    async fetch(request, server) {
      const url = new URL(request.url)
      const pathname = url.pathname
      const trace = createTraceIds()
      const startTs = performance.now()

      await emitAIEvent({
        kind: "request.start",
        severity: "info",
        source: "dev",
        message: "incoming dev request",
        requestId: trace.requestId,
        traceId: trace.traceId,
        spanId: trace.spanId,
        data: { method: request.method, pathname },
      })

      // Rate limiting by IP
      const ip = server.requestIP(request)?.address ?? "unknown"
      const rateLimitResponse = await createRateLimitResponse(state.rateLimiter, ip)
      if (rateLimitResponse) return rateLimitResponse

      const start = performance.now()
      const nonce = generateNonce()
      const secHeaders = securityHeaders({}, nonce)
      const match = matchRoute(state.routes, pathname, state.staticMap)
      const requestPlan = createRuntimeRequestPlan({
        pathname,
        hasRouteMatch: Boolean(match),
        allowHMR: true,
      })
      if (requestPlan[0] === "hmr") {
        const hmrPolicy = resolveRequestExecutionPolicy("rpc")
        const hmrMetadata = resolveRequestMetadata(request, {
          trustedOrigin: requestSecurityPolicy.trustedOrigin,
          trustForwardedHeaders: requestSecurityPolicy.trustForwardedHeaders,
          kind: "rpc",
          visibility: "internal",
        })
        const violation = validateRequestSecurityPolicy(hmrMetadata, hmrPolicy, requestSecurityPolicy)
        if (violation) return violation
        if (server.upgrade(request)) return new Response(null, { status: 101 })
        return new Response("WebSocket upgrade failed", { status: 400 })
      }

      const dispatch = await dispatchRuntimeRequestPlan({
        plan: requestPlan.filter((surface) => surface !== "hmr"),
        pathname,
        request,
        trace,
        startTs,
        source: "dev",
        route: match?.route.path,
        handlers: {
          rpc: async () => handleRPCWithHeaders(request, secHeaders, {
            middlewares: rpcMiddlewares,
            securityPolicy: requestSecurityPolicy,
          }),
          bundle: async () => tryServeClientBundle(state.clientDir, pathname),
          static: async () => tryServeStatic(state.publicDir, pathname),
          route: async () => {
            if (!match) return null
            await emitAIEvent({
              kind: "route.match",
              severity: "info",
              source: "dev",
              message: "route matched",
              requestId: trace.requestId,
              traceId: trace.traceId,
              spanId: trace.spanId,
              route: match.route.path,
              data: { pathname, file: match.route.filePath },
            })
            try {
              return await handlePageRequest({
                match, request, nonce, start, trace, trustedOrigin, clientBuild: state.clientBuild, secHeaders, wrapHTML: createDevHTMLWrapper,
                trustForwardedHeaders,
                securityPolicy: requestSecurityPolicy,
              })
            } catch (err) {
              const errObj = err instanceof Error ? err : new Error(String(err))
              log.error("request error", { path: pathname, error: errObj.message })
              await emitAIEvent({
                kind: "request.error",
                severity: "error",
                source: "dev",
                message: errObj.message,
                requestId: trace.requestId,
                traceId: trace.traceId,
                spanId: trace.spanId,
                route: match.route.path,
                durationMs: Number((performance.now() - startTs).toFixed(2)),
                data: { method: request.method, pathname, error: errObj.message },
              })
              return new Response(renderErrorOverlay(errObj, nonce), {
                status: 500,
                headers: { "Content-Type": "text/html", ...secHeaders },
              })
            }
          },
          "not-found": async () => {
            if (match) return null
            const notFoundHtml = await render404Page(state.routesDir, nonce)
            return new Response(notFoundHtml, {
              status: 404,
              headers: { "Content-Type": "text/html", ...secHeaders },
            })
          },
        },
      })
      if (dispatch) return dispatch.response
      throw new Error(`Unhandled request plan for ${pathname}`)
    },
    websocket: {
      open(ws) { addHMRClient(ws) },
      close(ws) { removeHMRClient(ws) },
      message() {},
    },
  })

  log.info("dev server started", { url: `http://localhost:${server.port}` })
  return server
}

export function isAllowedHMROrigin(request: Request, trustedOrigin?: string): boolean {
  const securityPolicy = createRequestSecurityPolicy({ trustedOrigin })
  const metadata = resolveRequestMetadata(request, {
    trustedOrigin: securityPolicy.trustedOrigin,
    kind: "rpc",
    visibility: "internal",
    trustForwardedHeaders: securityPolicy.trustForwardedHeaders,
  })
  return validateRequestSecurityPolicy(metadata, resolveRequestExecutionPolicy("rpc"), securityPolicy) === null
}

if (import.meta.main) {
  startDevServer().catch((err) => {
    console.error("Failed to start dev server:", err)
    process.exit(1)
  })
}
