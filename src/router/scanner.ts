// Route scanner -- reads routes/ directory, builds route tree

import { readdir, stat } from "node:fs/promises"
import { join, extname, basename } from "node:path"

export interface Route {
  path: string
  pattern: RegExp
  filePath: string
  isDynamic: boolean
  params: string[]
  layoutPath: string | null
  layoutPaths: string[]
  middlewarePath: string | null
  middlewarePaths: string[]
  errorPath: string | null
  loadingPath: string | null
}

const ROUTE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs"])
const IGNORED_PREFIXES = ["_"]

function fileToRoutePath(relativePath: string): string {
  let route = relativePath
    .replace(/\\/g, "/")
    .replace(/\.(tsx?|jsx?)$/, "")

  // index files -> parent path
  if (route === "index" || route.endsWith("/index")) {
    route = route.slice(0, -"index".length) || "/"
  }

  if (!route.startsWith("/")) route = "/" + route
  // Remove trailing slash (except root)
  if (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1)
  return route
}

function routeToPattern(routePath: string): { pattern: RegExp; params: string[] } {
  const params: string[] = []

  const regexStr = routePath
    .split("/")
    .map((segment) => {
      if (!segment) return ""

      // catch-all: [...path]
      if (segment.startsWith("[...") && segment.endsWith("]")) {
        const param = segment.slice(4, -1)
        params.push(param)
        return "(?:/(.+))?"
      }

      // dynamic: [id]
      if (segment.startsWith("[") && segment.endsWith("]")) {
        const param = segment.slice(1, -1)
        params.push(param)
        return "/([^/]+)"
      }

      return "/" + segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    })
    .join("")

  const finalRegex = regexStr || "/"
  return {
    pattern: new RegExp(`^${finalRegex}$`),
    params,
  }
}

interface ScanMaps {
  layouts: Map<string, string>
  middlewares: Map<string, string>
  errors: Map<string, string>
  loadings: Map<string, string>
}

async function scanDirectory(
  dir: string,
  basePath: string,
  routes: Route[],
  parent?: ScanMaps,
): Promise<ScanMaps> {
  const layouts = new Map<string, string>(parent?.layouts)
  const middlewares = new Map<string, string>(parent?.middlewares)

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return { layouts, middlewares, errors: new Map(), loadings: new Map() }
  }
  entries.sort((a, b) => a.localeCompare(b))

  // First pass: find layouts, middleware, error boundaries, and loading states
  const errors = new Map<string, string>(parent?.errors)
  const loadings = new Map<string, string>(parent?.loadings)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const name = basename(entry, extname(entry))

    if (name === "_layout") {
      layouts.set(basePath || "/", fullPath)
    }
    if (name === "_middleware") {
      middlewares.set(basePath || "/", fullPath)
    }
    if (name === "_error") {
      errors.set(basePath || "/", fullPath)
    }
    if (name === "_loading") {
      loadings.set(basePath || "/", fullPath)
    }
  }

  // Second pass: process routes and subdirectories
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const entryStat = await stat(fullPath)
    const name = basename(entry, extname(entry))

    if (entryStat.isDirectory()) {
      // Route groups: (group) directories don't add to URL path
      const isGroup = entry.startsWith("(") && entry.endsWith(")")
      const subPath = isGroup ? basePath : (basePath ? `${basePath}/${entry}` : entry)
      const sub = await scanDirectory(fullPath, subPath, routes, { layouts, middlewares, errors, loadings })
      for (const [k, v] of sub.layouts) layouts.set(k, v)
      for (const [k, v] of sub.middlewares) middlewares.set(k, v)
      for (const [k, v] of sub.errors) errors.set(k, v)
      for (const [k, v] of sub.loadings) loadings.set(k, v)
      continue
    }

    if (!ROUTE_EXTENSIONS.has(extname(entry))) continue
    if (IGNORED_PREFIXES.some((p) => name.startsWith(p))) continue

    const relPath = basePath ? `${basePath}/${entry}` : entry
    const routePath = fileToRoutePath(relPath)
    const { pattern, params } = routeToPattern(routePath)

    // Build middleware chain: collect from root → current directory
    const middlewarePaths: string[] = []
    const segments = (basePath || "/").split("/").filter(Boolean)
    const dirs = ["/"]
    for (let i = 0; i < segments.length; i++) {
      dirs.push(segments.slice(0, i + 1).join("/"))
    }
    for (const d of dirs) {
      const mwPath = middlewares.get(d)
      if (mwPath) middlewarePaths.push(mwPath)
    }

    // Build layout chain: collect from root → current directory
    const layoutPaths: string[] = []
    for (const d of dirs) {
      const lPath = layouts.get(d)
      if (lPath) layoutPaths.push(lPath)
    }

    // Find nearest loading component (walk up)
    let loadingPath: string | null = null
    for (let i = dirs.length - 1; i >= 0; i--) {
      const lp = loadings.get(dirs[i]!)
      if (lp) { loadingPath = lp; break }
    }

    // Find nearest error boundary (walk up)
    let errorPath: string | null = null
    for (let i = dirs.length - 1; i >= 0; i--) {
      const ep = errors.get(dirs[i]!)
      if (ep) { errorPath = ep; break }
    }

    routes.push({
      path: routePath,
      pattern,
      filePath: fullPath,
      isDynamic: params.length > 0,
      params,
      layoutPath: layoutPaths[layoutPaths.length - 1] ?? null,
      layoutPaths,
      middlewarePath: middlewarePaths[middlewarePaths.length - 1] ?? null,
      middlewarePaths,
      errorPath,
      loadingPath,
    })
  }

  return { layouts, middlewares, errors, loadings }
}

export async function createRouter(routesDir: string): Promise<Route[]> {
  const routes: Route[] = []
  await scanDirectory(routesDir, "", routes)

  // Sort: static routes first, then dynamic, then catch-all
  routes.sort((a, b) => {
    if (a.isDynamic !== b.isDynamic) return a.isDynamic ? 1 : -1
    const aCatchAll = a.path.includes("[...")
    const bCatchAll = b.path.includes("[...")
    if (aCatchAll !== bCatchAll) return aCatchAll ? 1 : -1
    return a.path.localeCompare(b.path)
  })

  const seen = new Map<string, string>()
  for (const route of routes) {
    const existing = seen.get(route.path)
    if (existing) {
      throw new Error(`Duplicate route path detected: ${route.path}\n- ${existing}\n- ${route.filePath}`)
    }
    seen.set(route.path, route.filePath)
  }

  return routes
}
