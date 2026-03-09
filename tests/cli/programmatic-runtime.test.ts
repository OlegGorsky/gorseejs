import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildProject } from "../../src/cli/cmd-build.ts"
import type { ClientBuildBackend } from "../../src/build/client-backend.ts"
import { generateDocs } from "../../src/cli/cmd-docs.ts"
import { generateRouteTypes } from "../../src/cli/cmd-typegen.ts"
import { generateCrudScaffold } from "../../src/cli/cmd-generate.ts"
import { checkProject } from "../../src/cli/cmd-check.ts"
import { resolveProjectPaths } from "../../src/cli/context.ts"
import { BUILD_MANIFEST_SCHEMA_VERSION, getClientBundleForRoute, isPrerenderedRoute, loadBuildManifest } from "../../src/server/manifest.ts"
import { ROUTE_FACTS_SCHEMA_VERSION } from "../../src/compiler/route-facts.ts"

const TMP = join(process.cwd(), ".tmp-cli-programmatic")
const paths = resolveProjectPaths(TMP)

describe("CLI programmatic runtime contracts", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(paths.routesDir, { recursive: true })
    await mkdir(join(paths.routesDir, "api"), { recursive: true })
    await mkdir(paths.publicDir, { recursive: true })
    await mkdir(paths.sharedDir, { recursive: true })
    await mkdir(paths.middlewareDir, { recursive: true })

    await writeFile(join(paths.routesDir, "index.tsx"), `
      import { Head } from "gorsee/client"

      export async function load() {
        return { message: "hello docs" }
      }

      export default function HomePage(props: any) {
        return (
          <>
            <Head><title>Programmatic</title></Head>
            <main>{props.data.message}</main>
          </>
        )
      }
    `.trim())
    await writeFile(join(paths.routesDir, "about.tsx"), `
      import { Head } from "gorsee/client"

      export const prerender = true

      export default function AboutPage() {
        return (
          <>
            <Head><title>About Programmatic</title></Head>
            <main>about prerendered</main>
          </>
        )
      }
    `.trim())
    await writeFile(join(paths.routesDir, "admin.tsx"), `
      /** Admin Console */
      import Layout from "../shared/layout"
      import * as auth from "../shared/auth"
      import { Head, Link } from "gorsee/client"

      export const meta = {
        title: "Admin",
        secure: true,
        tags: ["ops", "internal"],
        nested: { area: "control" },
      }

      export default class AdminPage {
        render() {
          return (
            <>
              <Head><title>Admin Console</title></Head>
              <main>{String(!!Layout && !!auth && !!Link)}</main>
            </>
          )
        }
      }
    `.trim())
    await writeFile(join(paths.routesDir, "settings.tsx"), `
      import type { Context } from "gorsee/server"
      import { Head } from "gorsee/client"

      export const meta = {
        title: "Settings",
        sections: ["profile", "security"],
        flags: { beta: false, public: null },
      }

      export async function load(_ctx: Context) {
        return { section: "profile" }
      }

      export default function SettingsPage(props: any) {
        return (
          <>
            <Head><title>Settings</title></Head>
            <main>{props.data.section}</main>
          </>
        )
      }
    `.trim())
    await writeFile(join(paths.routesDir, "api", "users.ts"), `
      import type { Context } from "gorsee/server"

      export async function GET(_ctx: Context) {
        return new Response("users")
      }

      export async function POST(_ctx: Context) {
        return new Response("created", { status: 201 })
      }
    `.trim())
    await writeFile(join(paths.publicDir, "robots.txt"), "User-agent: *\nAllow: /\n")
    await writeFile(join(paths.sharedDir, "layout.ts"), `
      export default function Layout(props: { children?: unknown }) {
        return props.children
      }
    `.trim())
    await writeFile(join(paths.sharedDir, "auth.ts"), `
      export const canManageUsers = true
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("resolveProjectPaths builds deterministic project layout", () => {
    expect(paths.clientDir).toBe(join(TMP, "dist", "client"))
    expect(paths.gorseeDir).toBe(join(TMP, ".gorsee"))
    expect(paths.migrationsDir).toBe(join(TMP, "migrations"))
  })

  test("buildProject uses options.cwd without process.chdir", async () => {
    await buildProject({ cwd: TMP })
    const manifest = await loadBuildManifest(paths.distDir)
    expect(manifest.schemaVersion).toBe(BUILD_MANIFEST_SCHEMA_VERSION)
    expect(manifest.routes["/"]?.hasLoader).toBe(true)
    expect(getClientBundleForRoute(manifest, "/")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/about")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/admin")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/settings")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/api/users")).toBeUndefined()
    expect(isPrerenderedRoute(manifest, "/about")).toBe(true)
    expect(manifest.prerendered).toContain("/about")
  })

  test("buildProject accepts a pluggable client build backend", async () => {
    const calls: Array<{ entrypoints: string[]; outdir: string }> = []
    const backend: ClientBuildBackend = {
      name: "stub",
      async build(options) {
        calls.push({ entrypoints: options.entrypoints, outdir: options.outdir })
        return { success: true, logs: [] }
      },
    }

    await buildProject({ cwd: TMP, clientBuildBackend: backend })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.entrypoints.length).toBeGreaterThan(0)
    expect(calls[0]?.outdir).toBe(join(TMP, ".gorsee", "client"))
  })

  test("generateDocs and generateRouteTypes use options.cwd without process.chdir", async () => {
    await generateDocs(["--output", "docs/api.json", "--format", "json"], { cwd: TMP })
    await generateRouteTypes([], { cwd: TMP })

    const docs = JSON.parse(await readFile(join(paths.docsDir, "api.json"), "utf-8")) as Array<{ path: string, hasLoader: boolean }>
    const routeTypes = await readFile(join(paths.gorseeDir, "routes.d.ts"), "utf-8")
    const routeFacts = JSON.parse(await readFile(join(paths.gorseeDir, "route-facts.json"), "utf-8")) as {
      schemaVersion: number
      routes: Array<{ path: string; methods: string[]; hasLoader: boolean; declaresPrerender: boolean; isApi: boolean; title: string; meta: Record<string, unknown> | null }>
    }

    expect(docs.some((doc) => doc.path === "/" && doc.hasLoader)).toBe(true)
    expect(docs.some((doc) => doc.path === "/settings" && doc.hasLoader)).toBe(true)
    expect(docs.some((doc) => doc.path === "/api/users" && doc.hasLoader === false)).toBe(true)
    expect(routeTypes).toContain('"/": {}')
    expect(routeTypes).toContain('"/admin": {}')
    expect(routeTypes).toContain('"/settings": {}')
    expect(routeTypes).toContain('"/api/users": {}')
    expect(routeFacts.schemaVersion).toBe(ROUTE_FACTS_SCHEMA_VERSION)
    expect(routeFacts.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/", hasLoader: true, declaresPrerender: false, isApi: false }),
      expect.objectContaining({ path: "/about", methods: [], hasLoader: false, declaresPrerender: true, isApi: false }),
      expect.objectContaining({ path: "/admin", hasLoader: false, title: "Admin Console" }),
      expect.objectContaining({
        path: "/settings",
        methods: [],
        hasLoader: true,
        meta: { title: "Settings", sections: ["profile", "security"], flags: { beta: false, public: null } },
      }),
      expect.objectContaining({ path: "/api/users", methods: ["GET", "POST"], hasLoader: false, isApi: true }),
    ]))
  })

  test("docs, typegen, and check can run under oxc backend", async () => {
    const env = { ...process.env, GORSEE_COMPILER_BACKEND: "oxc" }

    await generateDocs(["--output", "docs/api-oxc.json", "--format", "json"], { cwd: TMP, env })
    await generateRouteTypes([], { cwd: TMP, env })
    const check = await checkProject({ cwd: TMP, env, runTypeScript: false })

    const docs = JSON.parse(await readFile(join(paths.docsDir, "api-oxc.json"), "utf-8")) as Array<{
      path: string
      hasLoader: boolean
      title: string
      methods?: string[]
      meta?: Record<string, unknown> | null
    }>
    const routeFacts = JSON.parse(await readFile(join(paths.gorseeDir, "route-facts.json"), "utf-8")) as {
      schemaVersion: number
      routes: Array<{ path: string; methods: string[]; hasLoader: boolean; declaresPrerender: boolean; title: string; isApi: boolean; meta: Record<string, unknown> | null }>
    }

    expect(docs).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/", hasLoader: true }),
      expect.objectContaining({ path: "/about", hasLoader: false }),
      expect.objectContaining({ path: "/admin", title: "Admin Console" }),
      expect.objectContaining({ path: "/api/users", hasLoader: false }),
    ]))
    expect(routeFacts.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/", hasLoader: true }),
      expect.objectContaining({ path: "/about", declaresPrerender: true }),
      expect.objectContaining({
        path: "/settings",
        methods: [],
        hasLoader: true,
        meta: { title: "Settings", sections: ["profile", "security"], flags: { beta: false, public: null } },
      }),
      expect.objectContaining({ path: "/api/users", methods: ["GET", "POST"], isApi: true }),
    ]))
    expect(check.errors).toEqual([])
  })

  test("build can run under rolldown backend", async () => {
    const env = { ...process.env, GORSEE_BUILD_BACKEND: "rolldown" }

    await buildProject({ cwd: TMP, env })

    const manifest = await loadBuildManifest(paths.distDir)
    expect(manifest.schemaVersion).toBe(BUILD_MANIFEST_SCHEMA_VERSION)
    expect(getClientBundleForRoute(manifest, "/")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/about")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/admin")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/settings")).toMatch(/\.js$/)
    expect(getClientBundleForRoute(manifest, "/api/users")).toBeUndefined()
  })

  test("generateCrudScaffold and checkProject use options.cwd without process.chdir", async () => {
    await generateCrudScaffold(["posts"], { cwd: TMP })
    const check = await checkProject({ cwd: TMP, runTypeScript: false })
    const migrationFiles = await readdir(paths.migrationsDir)
    const repoModule = await readFile(join(paths.sharedDir, "posts.ts"), "utf-8")

    const listRoute = await readFile(join(paths.routesDir, "posts", "index.tsx"), "utf-8")

    expect(listRoute).toContain('from "gorsee/client"')
    expect(listRoute).toContain("export async function load()")
    expect(listRoute).toContain("<Link href={postRoutes.create}>")
    expect(listRoute).toContain('params={{ id: String(item.id) }}')
    expect(repoModule).toContain("export async function listPosts()")
    expect(repoModule).toContain('from "gorsee/routes"')
    expect(repoModule).toContain('from "gorsee/forms"')
    expect(repoModule).toContain("createTypedRoute")
    expect(repoModule).toContain("defineForm")
    expect(repoModule).not.toContain("TODO")
    expect(migrationFiles.some((file) => file.includes("create_posts"))).toBe(true)
    expect(check.info).toContain("Found 8 route(s)")
    expect(check.errors.length).toBe(0)
  })
})
