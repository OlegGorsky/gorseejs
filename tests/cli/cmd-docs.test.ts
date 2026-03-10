import { afterAll, describe, it, expect } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRouter } from "../../src/router/scanner.ts"
import {
  DOCS_ARTIFACT_SCHEMA_VERSION,
  createDocsArtifact,
  extractRouteInfo,
  generateDocs,
  parseDocsFlags,
  generateMarkdown,
  generateJson,
  generateJsonArtifact,
} from "../../src/cli/cmd-docs.ts"
import { analyzeModuleSource } from "../../src/compiler/module-analysis.ts"
import type { RouteDoc } from "../../src/cli/cmd-docs.ts"
import type { Route } from "../../src/router/scanner.ts"
import type { RouteCompilerFacts } from "../../src/compiler/route-facts.ts"

const ROUTES_DIR = join(import.meta.dir, "../../routes")
const TMP_DIR = join(import.meta.dir, "../.tmp-cmd-docs")

const sampleDocs: RouteDoc[] = [
  { path: "/", methods: ["GET"], hasLoader: true, isApi: false, hasMiddleware: false, title: "Home", meta: null },
  { path: "/api/health", methods: ["GET"], hasLoader: false, isApi: true, hasMiddleware: false, title: "", meta: null },
  { path: "/users/[id]", methods: ["GET"], hasLoader: true, isApi: false, hasMiddleware: true, title: "", meta: null },
]

afterAll(async () => {
  await rm(TMP_DIR, { recursive: true, force: true })
})

describe("cmd-docs", () => {
  it("parseDocsFlags defaults", () => {
    const flags = parseDocsFlags([])
    expect(flags.output).toBe("docs/api.md")
    expect(flags.format).toBe("md")
    expect(flags.routesOnly).toBe(false)
    expect(flags.contracts).toBe(false)
  })

  it("parseDocsFlags custom values", () => {
    const flags = parseDocsFlags(["--output", "out/api.json", "--format", "json", "--routes-only", "--contracts"])
    expect(flags.output).toBe("out/api.json")
    expect(flags.format).toBe("json")
    expect(flags.routesOnly).toBe(true)
    expect(flags.contracts).toBe(true)
  })

  it("generateMarkdown produces table with correct headers", () => {
    const md = generateMarkdown(sampleDocs)
    expect(md).toContain("| Path | Methods | Type | Loader | Middleware |")
    expect(md).toContain("| / | GET | Page | Yes | - |")
    expect(md).toContain("| /api/health | GET | API |")
  })

  it("generateJson produces valid JSON array", () => {
    const json = generateJson(sampleDocs)
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(3)
    expect(parsed[0].path).toBe("/")
  })

  it("createDocsArtifact preserves route contracts and summary", () => {
    const artifact = createDocsArtifact([
      {
        schemaVersion: 2,
        path: "/",
        params: [],
        methods: [],
        hasDefaultExport: true,
        hasLoader: true,
        isApi: false,
        hasMiddleware: false,
        title: "Home",
        meta: null,
        declaresPrerender: true,
      },
      {
        schemaVersion: 2,
        path: "/api/health",
        params: [],
        methods: ["GET"],
        hasDefaultExport: false,
        hasLoader: false,
        isApi: true,
        hasMiddleware: true,
        title: "",
        meta: { secure: true },
        declaresPrerender: false,
      },
    ] satisfies RouteCompilerFacts[])

    expect(artifact.schemaVersion).toBe(DOCS_ARTIFACT_SCHEMA_VERSION)
    expect(artifact.summary).toEqual({
      totalRoutes: 2,
      pageRoutes: 1,
      apiRoutes: 1,
      loaderRoutes: 1,
      middlewareRoutes: 1,
      prerenderedRoutes: 1,
    })
    expect(artifact.docs[0]?.methods).toEqual(["GET"])
    expect(artifact.routes[1]?.meta).toEqual({ secure: true })
  })

  it("generateJsonArtifact produces a machine-readable docs artifact", () => {
    const artifact = createDocsArtifact([
      {
        schemaVersion: 2,
        path: "/reports",
        params: [],
        methods: ["GET"],
        hasDefaultExport: true,
        hasLoader: false,
        isApi: false,
        hasMiddleware: false,
        title: "Reports",
        meta: null,
        declaresPrerender: false,
      },
    ] satisfies RouteCompilerFacts[])

    const json = generateJsonArtifact(artifact)
    const parsed = JSON.parse(json)

    expect(parsed.schemaVersion).toBe(DOCS_ARTIFACT_SCHEMA_VERSION)
    expect(parsed.summary.totalRoutes).toBe(1)
    expect(parsed.docs[0].path).toBe("/reports")
    expect(parsed.routes[0].methods).toEqual(["GET"])
  })

  it("json contracts artifact includes appMode", async () => {
    await mkdir(TMP_DIR, { recursive: true })
    await writeFile(join(TMP_DIR, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
      }
    `.trim())
    await mkdir(join(TMP_DIR, "routes", "api"), { recursive: true })
    await writeFile(join(TMP_DIR, "routes", "api", "health.ts"), `
      export function GET() {
        return Response.json({ status: "ok" })
      }
    `.trim())

    await generateDocs(["--format", "json", "--contracts", "--output", "docs/routes.json"], {
      cwd: TMP_DIR,
    })

    const output = JSON.parse(await Bun.file(join(TMP_DIR, "docs", "routes.json")).text())
    expect(output.appMode).toBe("server")
    expect(output.schemaVersion).toBe(DOCS_ARTIFACT_SCHEMA_VERSION)
  })

  it("detects API routes (no default export)", () => {
    const apiDoc = sampleDocs.find((d) => d.path === "/api/health")
    expect(apiDoc?.isApi).toBe(true)
  })

  it("createRouter finds routes from fixture directory", async () => {
    const routes = await createRouter(ROUTES_DIR)
    expect(routes.length).toBeGreaterThan(0)
    const paths = routes.map((r) => r.path)
    expect(paths).toContain("/")
  })

  it("extractRouteInfo uses AST for exported functions, const handlers, and literal meta", async () => {
    await mkdir(TMP_DIR, { recursive: true })
    const filePath = join(TMP_DIR, "users.tsx")
    await writeFile(filePath, `/** User Directory */
export const meta = {
  title: "Users",
  secure: true,
  tags: ["team", "admin"],
  nested: { area: "ops" },
}

export const GET = async () => new Response("ok")
export const load = async () => ({ users: [] })

export default function UsersPage() {
  return <div>Users</div>
}
`)

    const route: Route = {
      path: "/users",
      pattern: /^\/users$/,
      filePath,
      isDynamic: false,
      params: [],
      layoutPath: null,
      layoutPaths: [],
      middlewarePath: "routes/_middleware.ts",
      middlewarePaths: ["routes/_middleware.ts"],
      errorPath: null,
      loadingPath: null,
    }

    const info = await extractRouteInfo(route)
    expect(info.methods).toEqual(["GET"])
    expect(info.hasLoader).toBe(true)
    expect(info.isApi).toBe(true)
    expect(info.hasMiddleware).toBe(true)
    expect(info.title).toBe("User Directory")
    expect(info.meta).toEqual({
      title: "Users",
      secure: true,
      tags: ["team", "admin"],
      nested: { area: "ops" },
    })
  })

  it("analyzeModuleSource captures imports, exports, title, and meta facts", () => {
    const facts = analyzeModuleSource("routes/users.tsx", `/** Users */
import { Head } from "gorsee/client"
import { redirect as go } from "gorsee/server"
import * as api from "./api"

export const meta = { title: "Users", secure: true }
export const load = async () => ({ ok: true })
export default function Page() { return <main>{String(!!Head && !!go && !!api)}</main> }
`)

    expect(facts.exportedNames.has("meta")).toBe(true)
    expect(facts.exportedNames.has("load")).toBe(true)
    expect(facts.hasDefaultExport).toBe(true)
    expect(facts.title).toBe("Users")
    expect(facts.meta).toEqual({ title: "Users", secure: true })
    expect(facts.exportedLiterals).toEqual({
      meta: { title: "Users", secure: true },
    })
    expect(facts.imports).toEqual([
      { specifier: "gorsee/client", names: ["Head"], namespace: undefined, hasDefaultImport: false },
      { specifier: "gorsee/server", names: ["go"], namespace: undefined, hasDefaultImport: false },
      { specifier: "./api", names: [], namespace: "api", hasDefaultImport: false },
    ])
  })

  it("extractRouteInfo derives methods from canonical route facts contract", async () => {
    await mkdir(TMP_DIR, { recursive: true })
    const filePath = join(TMP_DIR, "api-report.ts")
    await writeFile(filePath, `
export async function GET() { return new Response("ok") }
export async function PATCH() { return new Response("patched") }
    `.trim())

    const route: Route = {
      path: "/api/report",
      pattern: /^\/api\/report$/,
      filePath,
      isDynamic: false,
      params: [],
      layoutPath: null,
      layoutPaths: [],
      middlewarePath: null,
      middlewarePaths: [],
      errorPath: null,
      loadingPath: null,
    }

    const info = await extractRouteInfo(route)
    expect(info.methods).toEqual(["GET", "PATCH"])
    expect(info.isApi).toBe(true)
  })
})
