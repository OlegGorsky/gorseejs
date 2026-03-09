export type TypedRouteParams = Record<string, string | undefined>
export type TypedRouteSearchValue = string | number | boolean | null | undefined | Array<string | number | boolean>

export interface TypedRouteOptions {
  params?: TypedRouteParams
  search?: Record<string, TypedRouteSearchValue>
  hash?: string
}

export interface TypedRouteDefinition {
  path: string
  params(): string[]
  build(options?: TypedRouteParams | TypedRouteOptions): string
  buildStrict(options: TypedRouteOptions): string
  navigate(options?: TypedRouteParams | TypedRouteOptions): Promise<void>
  prefetch(options?: TypedRouteParams | TypedRouteOptions): Promise<void>
}

export type TypedRouteTarget = string | TypedRouteDefinition

function isTypedRouteOptions(value: TypedRouteParams | TypedRouteOptions): value is TypedRouteOptions {
  return "params" in value || "search" in value || "hash" in value
}

function isTypedRouteDefinition(value: TypedRouteTarget): value is TypedRouteDefinition {
  return typeof value !== "string" && typeof value.build === "function" && typeof value.path === "string"
}

export function extractRouteParamKeys(path: string): string[] {
  return [...path.matchAll(/\[\.\.\.(\w+)\]|\[(\w+)\]/g)].map((match) => match[1] ?? match[2]!).filter(Boolean)
}

export function buildSearchParams(search: Record<string, TypedRouteSearchValue> = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
      continue
    }
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function buildTypedPath(path: string, params: TypedRouteParams = {}, strict = false): string {
  return path
    .replace(/\[\.\.\.(\w+)\]/g, (_, key) => {
      const value = params[key]
      if (strict && !value) throw new Error(`Missing route param: ${key}`)
      return value ?? ""
    })
    .replace(/\[(\w+)\]/g, (_, key) => {
      const value = params[key]
      if (strict && !value) throw new Error(`Missing route param: ${key}`)
      return encodeURIComponent(value ?? "")
    })
}

export function typedLink(
  target: TypedRouteTarget,
  paramsOrOptions: TypedRouteParams | TypedRouteOptions = {},
): string {
  if (isTypedRouteDefinition(target)) {
    return target.build(paramsOrOptions)
  }

  const options = isTypedRouteOptions(paramsOrOptions)
    ? paramsOrOptions
    : { params: paramsOrOptions }
  const pathname = buildTypedPath(target, options.params ?? {})
  const search = buildSearchParams(options.search)
  const hash = options.hash ? `#${options.hash.replace(/^#/, "")}` : ""
  return `${pathname}${search}${hash}`
}

export function resolveTypedRouteTarget(
  target: TypedRouteTarget,
  paramsOrOptions: TypedRouteParams | TypedRouteOptions = {},
): string {
  return typedLink(target, paramsOrOptions)
}

export function createTypedRoute(path: string): TypedRouteDefinition {
  return {
    path,
    params() {
      return extractRouteParamKeys(path)
    },
    build(options: TypedRouteParams | TypedRouteOptions = {}) {
      return typedLink(path, options)
    },
    buildStrict(options: TypedRouteOptions) {
      const pathname = buildTypedPath(path, options.params ?? {}, true)
      const search = buildSearchParams(options.search)
      const hash = options.hash ? `#${options.hash.replace(/^#/, "")}` : ""
      return `${pathname}${search}${hash}`
    },
    navigate(options: TypedRouteParams | TypedRouteOptions = {}) {
      return typedNavigate(path, options)
    },
    prefetch(options: TypedRouteParams | TypedRouteOptions = {}) {
      return typedPrefetch(path, options)
    },
  }
}

export function typedNavigate(
  target: TypedRouteTarget,
  paramsOrOptions: TypedRouteParams | TypedRouteOptions = {},
): Promise<void> {
  const url = typedLink(target, paramsOrOptions)
  return import("./router.ts").then((m) => m.navigate(url))
}

export function typedPrefetch(
  target: TypedRouteTarget,
  paramsOrOptions: TypedRouteParams | TypedRouteOptions = {},
): Promise<void> {
  const url = typedLink(target, paramsOrOptions)
  return import("./router.ts").then((m) => {
    m.prefetch(url)
  })
}
