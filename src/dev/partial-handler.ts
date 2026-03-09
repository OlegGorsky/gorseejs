// Handles partial navigation requests (X-Gorsee-Navigate: partial)
// Returns JSON with rendered HTML + metadata instead of full page

import { createContext } from "../server/middleware.ts"
import {
  createClientScriptPath,
  resolvePageRoute,
} from "../server/page-render.ts"
import { renderRoutePartialResponse } from "../server/route-response.ts"
import type { MatchResult } from "../router/matcher.ts"
import type { BuildResult } from "../build/client.ts"

interface PartialRenderOptions {
  match: MatchResult
  request: Request
  clientBuild: BuildResult
}

export async function handlePartialNavigation(opts: PartialRenderOptions): Promise<Response> {
  const { match, request, clientBuild } = opts
  const mod = await import(match.route.filePath)
  const ctx = createContext(request, match.params)

  // API routes don't support partial navigation
  if (typeof mod.GET === "function" || typeof mod.POST === "function") {
    return new Response("Not a page route", { status: 400 })
  }

  const resolved = await resolvePageRoute(mod, match, ctx)
  if (!resolved) {
    return new Response(JSON.stringify({ error: "Route has no default export" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const clientScript = createClientScriptPath(clientBuild.entryMap.get(match.route.path))
  return renderRoutePartialResponse({
    match,
    ctx,
    resolved,
    clientScript,
  })
}
