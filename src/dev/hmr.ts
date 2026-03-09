// Dev HMR contract.
// The dev runtime prefers typed, route-aware updates over blind full reloads.

import { relative } from "node:path"
import type { BuildResult } from "../build/client.ts"
import type { Route } from "../router/index.ts"

export type HMRUpdateKind = "full-reload" | "route-refresh" | "css-update"

export interface HMRUpdate {
  kind: HMRUpdateKind
  changedPath: string
  timestamp: number
  reason?: string
  routePaths?: string[]
  entryScripts?: string[]
  refreshCurrentRoute?: boolean
}

export interface HMRUpdateContext {
  changedPath: string
  routesDir: string
  sharedDir: string
  middlewareDir: string
  routes: Route[]
  clientBuild: BuildResult
}

export const HMR_CLIENT_SCRIPT = `<script data-g-hmr>
(function(){
  function reload() {
    location.reload();
  }
  function handleMessage(raw) {
    if (raw === "reload") {
      reload();
      return;
    }
    try {
      var payload = JSON.parse(raw);
      if (!payload || typeof payload !== "object") {
        reload();
        return;
      }
      if (typeof window.__gorseeHandleHMR === "function") {
        window.__gorseeHandleHMR(payload);
        return;
      }
    } catch {}
    reload();
  }
  var ws = new WebSocket((location.protocol==="https:"?"wss://":"ws://") + location.host + "/__gorsee_hmr");
  ws.onmessage = function(e) {
    handleMessage(String(e.data || ""));
  };
  ws.onclose = function() {
    setTimeout(function(){ reload(); }, 1000);
  };
})();
</script>`

const clients = new Set<{ send(data: string): void }>()

export function addHMRClient(ws: { send(data: string): void }): void {
  clients.add(ws)
}

export function removeHMRClient(ws: { send(data: string): void }): void {
  clients.delete(ws)
}

export function serializeHMRUpdate(update: HMRUpdate): string {
  return JSON.stringify(update)
}

export function notifyHMRUpdate(update: HMRUpdate): void {
  const payload = serializeHMRUpdate(update)
  for (const ws of clients) {
    try { ws.send(payload) } catch {}
  }
}

export function createHMRUpdate(context: HMRUpdateContext): HMRUpdate {
  const normalizedChangedPath = context.changedPath.replace(/\\/g, "/")
  const timestamp = Date.now()
  const isCSS = normalizedChangedPath.endsWith(".css")
  const routeMatches = context.routes.filter((route) =>
    route.filePath.replace(/\\/g, "/") === normalizedChangedPath
    || route.layoutPaths.some((layoutPath) => layoutPath.replace(/\\/g, "/") === normalizedChangedPath)
    || route.middlewarePaths.some((middlewarePath) => middlewarePath.replace(/\\/g, "/") === normalizedChangedPath)
    || route.errorPath?.replace(/\\/g, "/") === normalizedChangedPath
    || route.loadingPath?.replace(/\\/g, "/") === normalizedChangedPath,
  )
  const routePaths = routeMatches.map((route) => route.path)
  const entryScripts = routePaths
    .map((routePath) => context.clientBuild.entryMap.get(routePath))
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => `/_gorsee/${entry}`)

  if (normalizedChangedPath.startsWith(context.routesDir.replace(/\\/g, "/"))) {
    if (routePaths.length === 0 && entryScripts.length === 0) {
      return {
        kind: "full-reload",
        changedPath: normalizedChangedPath,
        timestamp,
        reason: "route change could not be mapped to a stable entry",
        refreshCurrentRoute: true,
      }
    }

    return {
      kind: isCSS ? "css-update" : "route-refresh",
      changedPath: normalizedChangedPath,
      timestamp,
      routePaths,
      entryScripts,
      refreshCurrentRoute: true,
    }
  }

  if (
    normalizedChangedPath.startsWith(context.sharedDir.replace(/\\/g, "/"))
    || normalizedChangedPath.startsWith(context.middlewareDir.replace(/\\/g, "/"))
  ) {
    return {
      kind: isCSS ? "css-update" : "route-refresh",
      changedPath: normalizedChangedPath,
      timestamp,
      reason: normalizedChangedPath.startsWith(context.sharedDir.replace(/\\/g, "/")) ? "shared dependency changed" : "middleware changed",
      refreshCurrentRoute: true,
    }
  }

  return {
    kind: "full-reload",
    changedPath: normalizedChangedPath,
    timestamp,
    reason: `unclassified dev update: ${relative(process.cwd(), normalizedChangedPath)}`,
    refreshCurrentRoute: true,
  }
}
