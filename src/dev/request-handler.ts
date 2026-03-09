// Page route request handler — SSR + streaming + layouts + loaders

import { log } from "../log/index.ts"
import {
  createClientScriptPath,
} from "../server/page-render.ts"
import { handleRouteRequest } from "../server/route-request.ts"
import {
  renderRouteErrorBoundaryResponse,
  renderRoutePageResponse,
  renderRoutePartialResponse,
} from "../server/route-response.ts"
import type { RequestSecurityPolicy } from "../server/request-security-policy.ts"
import type { MatchResult } from "../router/matcher.ts"
import type { BuildResult } from "../build/client.ts"

interface RenderOptions {
  match: MatchResult
  request: Request
  nonce: string
  start: number
  trace?: { requestId?: string; traceId?: string; spanId?: string; parentSpanId?: string }
  trustedOrigin?: string
  trustForwardedHeaders?: boolean
  securityPolicy?: RequestSecurityPolicy
  clientBuild: BuildResult
  secHeaders: Record<string, string>
  wrapHTML: (body: string, nonce: string | undefined, opts?: { title?: string; clientScript?: string; loaderData?: unknown; params?: Record<string, string>; cssFiles?: string[]; headElements?: string[] }) => string
}

async function renderPageRoute(
  opts: RenderOptions & {
    ctx: import("../server/middleware.ts").Context
    resolved: import("../server/page-render.ts").ResolvedPageRoute
  },
): Promise<Response> {
  const { match, request, nonce, start, clientBuild, ctx, resolved } = opts
  const clientScript = createClientScriptPath(clientBuild.entryMap.get(match.route.path))
  const response = await renderRoutePageResponse({
    match,
    ctx,
    resolved,
    clientScript,
    nonce,
    secHeaders: opts.secHeaders,
    wrapHTML: opts.wrapHTML,
  })
  const elapsed = (performance.now() - start).toFixed(1)
  log.info("request", {
    method: request.method,
    path: match.route.path,
    status: response.status,
    ms: elapsed,
    mode: resolved.renderMode === "stream" ? "stream" : "async",
  })
  return response
}

async function renderPartialRoute(
  opts: RenderOptions & {
    ctx: import("../server/middleware.ts").Context
    resolved: import("../server/page-render.ts").ResolvedPageRoute
  },
): Promise<Response> {
  const { match, clientBuild, ctx, resolved } = opts
  const clientScript = createClientScriptPath(clientBuild.entryMap.get(match.route.path))
  return renderRoutePartialResponse({
    match,
    ctx,
    resolved,
    clientScript,
    secHeaders: opts.secHeaders,
  })
}

export async function handlePageRequest(opts: RenderOptions): Promise<Response> {
  const { match, request } = opts
  return handleRouteRequest({
    match,
    request,
    trace: opts.trace,
    trustedOrigin: opts.trustedOrigin,
    trustForwardedHeaders: opts.trustForwardedHeaders,
    securityPolicy: opts.securityPolicy,
    onPartialRequest: async ({ ctx, resolved }) => renderPartialRoute({ ...opts, ctx, resolved }),
    onPageRequest: async ({ ctx, resolved }) => renderPageRoute({ ...opts, ctx, resolved }),
    onRouteError: async (err) => {
      if (match.route.errorPath) {
        const errObj = err instanceof Error ? err : new Error(String(err))
        return renderErrorBoundary(match.route.errorPath, errObj, opts)
      }
      throw err
    },
  })
}

async function renderErrorBoundary(errorPath: string, error: Error, opts: RenderOptions): Promise<Response> {
  return renderRouteErrorBoundaryResponse(errorPath, error, {
    match: opts.match,
    nonce: opts.nonce,
    secHeaders: opts.secHeaders,
    wrapHTML: opts.wrapHTML,
  })
}
