import { transformServerCalls } from "./rpc-transform.ts"

export const SERVER_ONLY_MODULES = ["gorsee/db", "gorsee/log"] as const

export const SERVER_STUB_MODULES: Record<string, string> = {
  "gorsee/server": `export function server(fn) { return fn; }
export function middleware(fn) { return fn; }`,
}

const SERVER_IMPORT_REGEXES = SERVER_ONLY_MODULES.map(
  (mod) => new RegExp(`import\\s+.*?from\\s+["']${mod.replace("/", "\\/")}["'];?\\n?`, "g"),
)

export interface RouteClientTransformResult {
  source: string
  removedLoader: boolean
  removedServerImports: number
  transformedServerCalls: boolean
}

export function stripRouteLoader(source: string): { source: string; removed: boolean } {
  for (const hookName of ["load", "loader"] as const) {
    const loaderRe = new RegExp(`export\\s+(async\\s+)?function\\s+${hookName}\\s*\\([^)]*\\)\\s*(\\{)`, "g")
    const match = loaderRe.exec(source)
    if (!match) continue

    const start = match.index
    let braces = 1
    let index = loaderRe.lastIndex

    while (index < source.length && braces > 0) {
      if (source[index] === "{") braces++
      else if (source[index] === "}") braces--
      index++
    }

    return {
      source: source.slice(0, start) + source.slice(index),
      removed: true,
    }
  }

  return { source, removed: false }
}

export function stripServerOnlyImports(source: string): { source: string; removedCount: number } {
  let next = source
  let removedCount = 0

  for (const re of SERVER_IMPORT_REGEXES) {
    re.lastIndex = 0
    const matches = [...next.matchAll(re)]
    if (matches.length === 0) continue
    removedCount += matches.length
    next = next.replace(re, "")
  }

  return { source: next, removedCount }
}

export function applyRouteClientTransforms(source: string, filePath: string): RouteClientTransformResult {
  const loaderResult = stripRouteLoader(source)
  const importResult = stripServerOnlyImports(loaderResult.source)
  const rpcSource = transformServerCalls(importResult.source, filePath)

  return {
    source: rpcSource,
    removedLoader: loaderResult.removed,
    removedServerImports: importResult.removedCount,
    transformedServerCalls: rpcSource !== importResult.source,
  }
}
