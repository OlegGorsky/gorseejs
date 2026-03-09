import {
  RedirectError,
  sanitizeRedirectTarget,
  type Context,
  type MiddlewareFn,
} from "./middleware.ts"
import { handleAction, type ActionFn } from "./action.ts"
import { resolvePageRoute, type ResolvedPageRoute } from "./page-render.ts"
import { executeServerExecution } from "./server-execution.ts"
import {
  classifyRouteRequest,
} from "./request-policy.ts"
import {
  createRequestSecurityPolicy,
  type RequestSecurityPolicy,
} from "./request-security-policy.ts"
import type { MatchResult } from "../router/matcher.ts"
import { emitAIEvent, type AITraceContext } from "../ai/index.ts"

type RouteModule = Record<string, unknown>

interface RouteRequestContext {
  match: MatchResult
  request: Request
  mod: RouteModule
  ctx: Context
}

interface ResolvedRouteRequestContext extends RouteRequestContext {
  resolved: ResolvedPageRoute
}

interface RouteRequestOptions {
  match: MatchResult
  request: Request
  trustedOrigin?: string
  trustForwardedHeaders?: boolean
  trustedForwardedHops?: number
  securityPolicy?: RequestSecurityPolicy
  trace?: Partial<AITraceContext>
  extraMiddlewares?: MiddlewareFn[]
  onActionRequest?: (ctx: RouteRequestContext) => Promise<Response>
  onPartialRequest: (ctx: ResolvedRouteRequestContext) => Promise<Response>
  onPageRequest: (ctx: ResolvedRouteRequestContext) => Promise<Response>
  onRouteError?: (error: unknown, ctx: RouteRequestContext) => Promise<Response>
}

export async function handleRouteRequest(options: RouteRequestOptions): Promise<Response> {
  const { match, request, extraMiddlewares = [], onActionRequest, onPartialRequest, onPageRequest, onRouteError } = options
  const mod = await import(match.route.filePath)
  const requestKind = classifyRouteRequest(mod, request)
  const securityPolicy = options.securityPolicy ?? createRequestSecurityPolicy({
    trustedOrigin: options.trustedOrigin,
    trustForwardedHeaders: options.trustForwardedHeaders,
    trustedForwardedHops: options.trustedForwardedHops,
  })
  let routeCtx: RouteRequestContext | undefined
  let resolvedRouteCtx: ResolvedRouteRequestContext | undefined

  try {
    const middlewares = await loadRouteMiddlewares(match, mod, extraMiddlewares)
    return await executeServerExecution({
      request,
      kind: requestKind,
      params: match.params,
      securityPolicy,
      middlewares,
      trace: options.trace,
      route: match.route.path,
      handler: async ({ ctx }) => {
        routeCtx = { match, request, mod, ctx }
        if (requestKind === "route-handler") {
          const handlerName = request.method === "POST" ? "POST" : "GET"
          return (mod[handlerName] as (ctx: Context) => Promise<Response> | Response)(ctx)
        }
        if (requestKind === "action") {
          if (onActionRequest) return onActionRequest(routeCtx)
          return handleActionRequest(mod.action as ActionFn, ctx, request)
        }
        if (requestKind === "partial") {
          return onPartialRequest(await ensureResolvedRouteContext())
        }
        return onPageRequest(await ensureResolvedRouteContext())
      },
    })
  } catch (error) {
    if (error instanceof RedirectError) {
      const ctx = routeCtx?.ctx
      await emitAIEvent({
        kind: "redirect",
        severity: "info",
        source: "runtime",
        message: "route redirect thrown",
        requestId: typeof ctx?.locals.requestId === "string" ? ctx.locals.requestId : undefined,
        traceId: typeof ctx?.locals.traceId === "string" ? ctx.locals.traceId : undefined,
        spanId: typeof ctx?.locals.spanId === "string" ? ctx.locals.spanId : undefined,
        route: match.route.path,
        data: {
          method: request.method,
          pathname: ctx?.url.pathname ?? new URL(request.url).pathname,
          status: error.status,
          requestKind,
        },
      })
      return new Response(null, {
        status: error.status,
        headers: {
          Location: sanitizeRedirectTarget(
            error.url,
            securityPolicy.trustedOrigin ?? routeCtx?.ctx.url ?? new URL(request.url),
          ),
        },
      })
    }
    if (onRouteError && routeCtx) return onRouteError(error, routeCtx)
    throw error
  }

  async function ensureResolvedRouteContext(): Promise<ResolvedRouteRequestContext> {
    if (resolvedRouteCtx) return resolvedRouteCtx
    if (!routeCtx) throw new Error("Route context is not initialized")
    const resolved = await resolvePageRoute(mod, match, routeCtx.ctx)
    if (!resolved) throw new Error("Route has no default export")
    resolvedRouteCtx = { ...routeCtx, resolved }
    return resolvedRouteCtx
  }
}

async function loadRouteMiddlewares(
  match: MatchResult,
  mod: RouteModule,
  extraMiddlewares: MiddlewareFn[],
): Promise<MiddlewareFn[]> {
  const middlewares = [...extraMiddlewares]
  for (const mwPath of match.route.middlewarePaths) {
    const mwMod = await import(mwPath)
    if (typeof mwMod.default === "function") middlewares.push(mwMod.default)
  }
  if (typeof mod.guard === "function") {
    middlewares.push(mod.guard as MiddlewareFn)
  }
  return middlewares
}

async function handleActionRequest(action: ActionFn, ctx: Context, request: Request): Promise<Response> {
  const result = await handleAction(action, ctx)
  if (request.headers.get("Accept")?.includes("application/json")) {
    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    })
  }
  return new Response(null, {
    status: 303,
    headers: { Location: request.url },
  })
}
