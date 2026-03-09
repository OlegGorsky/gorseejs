import type { Route } from "./scanner.ts"

export interface MatchResult {
  route: Route
  params: Record<string, string>
}

// Pre-build a lookup map for static routes (O(1) matching)
export function buildStaticMap(routes: Route[]): Map<string, Route> {
  const map = new Map<string, Route>()
  for (const route of routes) {
    if (!route.isDynamic) map.set(route.path, route)
  }
  return map
}

export function matchRoute(
  routes: Route[],
  pathname: string,
  staticMap?: Map<string, Route>,
): MatchResult | null {
  const normalized = normalizePathname(pathname)

  // Fast O(1) lookup for static routes
  if (staticMap) {
    const staticRoute = staticMap.get(normalized)
    if (staticRoute) return { route: staticRoute, params: {} }
  }

  // Fallback to regex matching for dynamic routes
  for (const route of routes) {
    if (!route.isDynamic && staticMap) continue
    const match = route.pattern.exec(normalized)
    if (!match) continue

    const params: Record<string, string> = {}
    for (let i = 0; i < route.params.length; i++) {
      const value = match[i + 1]
      if (value !== undefined) {
        try {
          params[route.params[i]!] = decodeURIComponent(value)
        } catch {
          params[route.params[i]!] = value
        }
      }
    }

    return { route, params }
  }

  return null
}

function normalizePathname(pathname: string): string {
  const normalized = pathname
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")

  if (normalized === "/") return "/"
  return normalized.replace(/\/+$/, "") || "/"
}
