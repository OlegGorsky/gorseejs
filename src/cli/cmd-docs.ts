// gorsee docs -- generate API documentation from route files

import { dirname, join } from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { createRouter, type Route } from "../router/scanner.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"
import { initializeCompilerBackends } from "../compiler/init.ts"
import {
  createRouteFactsArtifact,
  inspectRouteFacts,
  toRouteDocSurface,
  type RouteCompilerFacts,
} from "../compiler/route-facts.ts"
import { loadAppConfig, resolveAppMode, type AppMode } from "../runtime/app-config.ts"

interface DocFlags {
  output: string
  format: "md" | "json" | "html"
  routesOnly: boolean
  contracts: boolean
}

interface RouteDoc {
  path: string
  methods: string[]
  hasLoader: boolean
  isApi: boolean
  hasMiddleware: boolean
  title: string
  meta: Record<string, unknown> | null
}

export const DOCS_ARTIFACT_SCHEMA_VERSION = 1 as const

export interface DocsArtifactSummary {
  totalRoutes: number
  pageRoutes: number
  apiRoutes: number
  loaderRoutes: number
  middlewareRoutes: number
  prerenderedRoutes: number
}

export interface DocsArtifact {
  schemaVersion: typeof DOCS_ARTIFACT_SCHEMA_VERSION
  generatedAt: string
  appMode: AppMode
  summary: DocsArtifactSummary
  routes: RouteCompilerFacts[]
  docs: RouteDoc[]
}

export function parseDocsFlags(args: string[]): DocFlags {
  const flags: DocFlags = { output: "docs/api.md", format: "md", routesOnly: false, contracts: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === "--output" && args[i + 1]) flags.output = args[++i]!
    else if (arg === "--format" && args[i + 1]) {
      const fmt = args[++i]!
      if (fmt === "md" || fmt === "json" || fmt === "html") flags.format = fmt
    } else if (arg === "--routes-only") flags.routesOnly = true
    else if (arg === "--contracts") flags.contracts = true
  }

  return flags
}

async function extractRouteInfo(route: Route): Promise<RouteDoc> {
  const routeFacts = await inspectRouteFacts(route)
  return extractRouteInfoFromFacts(routeFacts)
}

function extractRouteInfoFromFacts(routeFacts: RouteCompilerFacts): RouteDoc {
  return toRouteDocSurface(routeFacts)
}

function generateMarkdown(docs: RouteDoc[]): string {
  const lines = ["# API Documentation", "", "| Path | Methods | Type | Loader | Middleware |", "| --- | --- | --- | --- | --- |"]
  for (const doc of docs) {
    const type = doc.isApi ? "API" : "Page"
    const mw = doc.hasMiddleware ? "Yes" : "-"
    lines.push(`| ${doc.path} | ${doc.methods.join(", ")} | ${type} | ${doc.hasLoader ? "Yes" : "-"} | ${mw} |`)
  }
  return lines.join("\n") + "\n"
}

function generateJson(docs: RouteDoc[]): string {
  return JSON.stringify(docs, null, 2) + "\n"
}

export function summarizeRouteFacts(routeFacts: RouteCompilerFacts[]): DocsArtifactSummary {
  return {
    totalRoutes: routeFacts.length,
    pageRoutes: routeFacts.filter((route) => !route.isApi).length,
    apiRoutes: routeFacts.filter((route) => route.isApi).length,
    loaderRoutes: routeFacts.filter((route) => route.hasLoader).length,
    middlewareRoutes: routeFacts.filter((route) => route.hasMiddleware).length,
    prerenderedRoutes: routeFacts.filter((route) => route.declaresPrerender).length,
  }
}

export function createDocsArtifact(routeFacts: RouteCompilerFacts[], appMode: AppMode = "fullstack"): DocsArtifact {
  return {
    schemaVersion: DOCS_ARTIFACT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    appMode,
    summary: summarizeRouteFacts(routeFacts),
    routes: routeFacts,
    docs: routeFacts.map(extractRouteInfoFromFacts),
  }
}

export function generateJsonArtifact(artifact: DocsArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n"
}

function generateHtml(docs: RouteDoc[]): string {
  const rows = docs.map((d) => {
    const type = d.isApi ? "API" : "Page"
    const mw = d.hasMiddleware ? "Yes" : "-"
    return `<tr><td>${d.path}</td><td>${d.methods.join(", ")}</td><td>${type}</td><td>${d.hasLoader ? "Yes" : "-"}</td><td>${mw}</td></tr>`
  }).join("\n      ")

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>API Docs</title>
<style>body{font-family:sans-serif;margin:2rem}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style>
</head><body><h1>API Documentation</h1>
<table><thead><tr><th>Path</th><th>Methods</th><th>Type</th><th>Loader</th><th>Middleware</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>\n`
}

const GENERATORS: Record<string, (docs: RouteDoc[]) => string> = {
  md: generateMarkdown,
  json: generateJson,
  html: generateHtml,
}

export interface DocsCommandOptions extends RuntimeOptions {}

export async function generateDocs(args: string[], options: DocsCommandOptions = {}) {
  const { cwd, paths } = createProjectContext(options)
  initializeCompilerBackends(options.env ?? process.env)
  const flags = parseDocsFlags(args)
  const appMode = resolveAppMode(await loadAppConfig(cwd))

  const routes = await createRouter(paths.routesDir)
  if (routes.length === 0) {
    console.log("\n  No routes found in routes/\n")
    return
  }

  const routeFacts = await createRouteFactsArtifact(routes)
  const docs: RouteDoc[] = []
  for (const info of routeFacts.routes.map(extractRouteInfoFromFacts)) {
    if (flags.routesOnly && info.isApi) continue
    docs.push(info)
  }

  const generate = GENERATORS[flags.format]!
  const filteredRouteFacts = routeFacts.routes.filter((route) => {
    const info = extractRouteInfoFromFacts(route)
    return !(flags.routesOnly && info.isApi)
  })
  const content = flags.format === "json" && flags.contracts
    ? generateJsonArtifact(createDocsArtifact(filteredRouteFacts, appMode))
    : generate(docs)

  const outputPath = join(cwd, flags.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, content, "utf-8")

  console.log(`\n  Generated docs for ${docs.length} routes -> ${flags.output}\n`)
}

/** @deprecated Use generateDocs() for programmatic access. */
export async function runDocs(args: string[], options: DocsCommandOptions = {}) {
  return generateDocs(args, options)
}

export { extractRouteInfo, extractRouteInfoFromFacts, generateMarkdown, generateJson, generateHtml }
export type { RouteDoc, DocFlags }
