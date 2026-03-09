import { readFile } from "node:fs/promises"
import type { Route } from "../router/scanner.ts"
import { analyzeModuleSource } from "./module-analysis.ts"

export const ROUTE_FACTS_SCHEMA_VERSION = 2 as const

export interface RouteCompilerFacts {
  schemaVersion: typeof ROUTE_FACTS_SCHEMA_VERSION
  path: string
  params: string[]
  methods: string[]
  hasDefaultExport: boolean
  hasLoader: boolean
  isApi: boolean
  hasMiddleware: boolean
  title: string
  meta: Record<string, unknown> | null
  declaresPrerender: boolean
}

export interface RouteDocSurface {
  path: string
  methods: string[]
  hasLoader: boolean
  isApi: boolean
  hasMiddleware: boolean
  title: string
  meta: Record<string, unknown> | null
}

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const

export interface RouteFactsArtifact {
  schemaVersion: typeof ROUTE_FACTS_SCHEMA_VERSION
  routes: RouteCompilerFacts[]
}

export function getRouteFactMethods(routeFacts: RouteCompilerFacts): string[] {
  const methods = [...routeFacts.methods]
  if (methods.length === 0 && routeFacts.hasDefaultExport) methods.push("GET")
  if (methods.length === 0 && routeFacts.hasLoader) methods.push("GET")
  return methods
}

export function toRouteDocSurface(routeFacts: RouteCompilerFacts): RouteDocSurface {
  return {
    path: routeFacts.path,
    methods: getRouteFactMethods(routeFacts),
    hasLoader: routeFacts.hasLoader,
    isApi: routeFacts.isApi,
    hasMiddleware: routeFacts.hasMiddleware,
    title: routeFacts.title,
    meta: routeFacts.meta,
  }
}

export function getRouteParamsRecord(routeFacts: RouteCompilerFacts): Record<string, "string"> {
  const params: Record<string, "string"> = {}
  for (const param of routeFacts.params) {
    params[param] = "string"
  }
  return params
}

export async function inspectRouteFacts(route: Route): Promise<RouteCompilerFacts> {
  const content = await readFile(route.filePath, "utf-8")
  const facts = analyzeModuleSource(route.filePath, content)
  const methods = HTTP_METHODS.filter((method) => facts.exportedNames.has(method))
  const hasLoader = facts.exportedNames.has("load") || facts.exportedNames.has("loader")
  const isApi = !facts.hasDefaultExport || methods.length > 0

  return {
    schemaVersion: ROUTE_FACTS_SCHEMA_VERSION,
    path: route.path,
    params: [...route.params],
    methods: [...methods],
    hasDefaultExport: facts.hasDefaultExport,
    hasLoader,
    isApi,
    hasMiddleware: route.middlewarePaths.length > 0,
    title: facts.title,
    meta: facts.meta,
    declaresPrerender: facts.exportedLiterals.prerender === true,
  }
}

export async function createRouteFactsArtifact(routes: Route[]): Promise<RouteFactsArtifact> {
  const facts = await Promise.all(routes.map((route) => inspectRouteFacts(route)))
  return {
    schemaVersion: ROUTE_FACTS_SCHEMA_VERSION,
    routes: facts,
  }
}

export function parseRouteFactsArtifact(raw: string): RouteFactsArtifact {
  const artifact = JSON.parse(raw) as Partial<RouteFactsArtifact>
  validateRouteFactsArtifact(artifact)
  return artifact
}

function validateRouteFactsArtifact(artifact: Partial<RouteFactsArtifact>): asserts artifact is RouteFactsArtifact {
  if (artifact.schemaVersion !== ROUTE_FACTS_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported route facts schema version: expected ${ROUTE_FACTS_SCHEMA_VERSION}, received ${String(artifact.schemaVersion)}`,
    )
  }
  if (!Array.isArray(artifact.routes)) {
    throw new Error("Invalid route facts artifact: routes must be an array")
  }
  for (const route of artifact.routes) {
    if (!route || typeof route !== "object") {
      throw new Error("Invalid route facts artifact: route entry must be an object")
    }
    if (route.schemaVersion !== ROUTE_FACTS_SCHEMA_VERSION) {
      throw new Error("Invalid route facts artifact: route schemaVersion drift detected")
    }
    if (typeof route.path !== "string" || route.path.length === 0) {
      throw new Error("Invalid route facts artifact: route path must be a non-empty string")
    }
    if (!Array.isArray(route.params)) {
      throw new Error("Invalid route facts artifact: params must be an array")
    }
    if (!Array.isArray(route.methods)) {
      throw new Error("Invalid route facts artifact: methods must be an array")
    }
  }
}
