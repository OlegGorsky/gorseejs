import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { checkProject } from "../../src/cli/cmd-check.ts"

const TMP = join(process.cwd(), ".tmp-cmd-check")

describe("cmd-check security rules", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
    await mkdir(join(TMP, "shared"), { recursive: true })
    await mkdir(join(TMP, "middleware"), { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-check-app",
      version: "0.0.0",
    }, null, 2))
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("warns when server() is used without security.rpc.middlewares", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "index.tsx"), `
      import { server } from "gorsee/server"
      const doThing = server(async () => ({ ok: true }))
      export default function Page() { return <main>{String(!!doThing)}</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W903")).toBe(true)
  })

  test("does not warn when security.rpc.middlewares are configured", async () => {
    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "https://app.example.com",
          rpc: {
            middlewares: [],
          },
        },
      }
    `.trim())
    await writeFile(join(TMP, "routes", "index.tsx"), `
      import { server } from "gorsee/server"
      const doThing = server(async () => ({ ok: true }))
      export default function Page() { return <main>{String(!!doThing)}</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W903")).toBe(false)
  })

  test("warns when routeCache lacks explicit cache intent", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "cached.ts"), `
      import { routeCache } from "gorsee/server"
      export const cache = routeCache({ maxAge: 60 })
      export default function CachedPage() { return <main>cached</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W904")).toBe(true)
  })

  test("warns when frontend mode drifts into server-only surfaces", async () => {
    const frontendRoot = join(TMP, "frontend-mode")
    await rm(frontendRoot, { recursive: true, force: true })
    await mkdir(join(frontendRoot, "routes"), { recursive: true })
    await mkdir(join(frontendRoot, "shared"), { recursive: true })
    await mkdir(join(frontendRoot, "middleware"), { recursive: true })
    await writeFile(join(frontendRoot, "package.json"), JSON.stringify({ name: "frontend-mode", version: "0.0.0" }, null, 2))
    await writeFile(join(frontendRoot, "app.config.ts"), `
      export default {
        app: {
          mode: "frontend",
        },
      }
    `.trim())
    await writeFile(join(frontendRoot, "routes", "index.tsx"), `
      import { server } from "gorsee/server"

      const fn = server(async () => ({ ok: true }))

      export default function Page() {
        return <main>{String(Boolean(fn))}</main>
      }
    `.trim())

    const result = await checkProject({ cwd: frontendRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W923")).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W924")).toBe(true)
  })

  test("warns when server mode imports browser-only surfaces", async () => {
    const serverRoot = join(TMP, "server-mode")
    await rm(serverRoot, { recursive: true, force: true })
    await mkdir(join(serverRoot, "routes"), { recursive: true })
    await mkdir(join(serverRoot, "shared"), { recursive: true })
    await mkdir(join(serverRoot, "middleware"), { recursive: true })
    await writeFile(join(serverRoot, "package.json"), JSON.stringify({ name: "server-mode", version: "0.0.0" }, null, 2))
    await writeFile(join(serverRoot, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
        security: {
          origin: "https://app.example.com",
        },
      }
    `.trim())
    await writeFile(join(serverRoot, "routes", "index.tsx"), `
      import { Link } from "gorsee/client"

      export default function Page() {
        return <Link href="/">home</Link>
      }
    `.trim())

    const result = await checkProject({ cwd: serverRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W926")).toBe(true)
  })

  test("server mode does not require routes directory for worker-only service shapes", async () => {
    const workerRoot = join(TMP, "server-worker-only")
    await rm(workerRoot, { recursive: true, force: true })
    await mkdir(join(workerRoot, "workers"), { recursive: true })
    await writeFile(join(workerRoot, "package.json"), JSON.stringify({ name: "server-worker-only", version: "0.0.0" }, null, 2))
    await writeFile(join(workerRoot, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
      }
    `.trim())
    await writeFile(join(workerRoot, "workers", "main.ts"), `
      export const worker = true
    `.trim())

    const result = await checkProject({ cwd: workerRoot, runTypeScript: false })

    expect(result.errors.some((issue) => issue.code === "E902")).toBe(false)
  })

  test("does not warn when routeCache declares explicit intent", async () => {
    await writeFile(join(TMP, "routes", "cached.ts"), `
      import { routeCache } from "gorsee/server"
      export const cache = routeCache({
        maxAge: 60,
        includeAuthHeaders: false,
      })
      export default function CachedPage() { return <main>cached</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W904")).toBe(false)
  })

  test("warns when throwable redirect uses non-literal target", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "redirect.tsx"), `
      import { redirect } from "gorsee/server"
      export async function loader() {
        const nextUrl = new URLSearchParams("next=/dashboard").get("next")
        redirect(nextUrl)
      }
      export default function RedirectPage() { return <main>redirect</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W905")).toBe(true)
  })

  test("warns when route module still exports loader instead of canonical load", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "legacy-loader.tsx"), `
      export async function loader() {
        return { ok: true }
      }
      export default function LegacyLoaderPage() { return <main>legacy</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W916" && issue.file.endsWith("legacy-loader.tsx"))).toBe(true)
  })

  test("AST-aware check catches multiline redirect and routeCache patterns", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "ast.tsx"), `
      import { redirect, routeCache } from "gorsee/server"
      const nextUrl =
        new URLSearchParams("next=/dashboard").get("next")

      export const cache = routeCache(
        {
          maxAge: 60,
        }
      )

      export async function loader() {
        return redirect(
          nextUrl
        )
      }

      export default function AstPage() { return <main>ast</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W904" && issue.file.endsWith("ast.tsx"))).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W905" && issue.file.endsWith("ast.tsx"))).toBe(true)
  })

  test("warns when origin-sensitive server features do not configure security.origin", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { rpc: { middlewares: [] } } }`)
    await writeFile(join(TMP, "routes", "origin.tsx"), `
      import { redirect } from "gorsee/server"
      export async function loader() {
        redirect("/dashboard")
      }
      export default function OriginPage() { return <main>origin</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W906")).toBe(true)
  })

  test("warns when runtime dependencies use floating ranges", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-check-app",
      version: "0.0.0",
      dependencies: {
        devalue: "^5.1.1",
      },
    }, null, 2))

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W907")).toBe(true)
  })

  test("warns when bun.lock drifts from pinned runtime dependency versions", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-check-app",
      version: "0.0.0",
      dependencies: {
        devalue: "5.6.3",
      },
    }, null, 2))
    await writeFile(join(TMP, "bun.lock"), `{
      "lockfileVersion": 1,
      "packages": {
        "devalue": ["devalue@5.1.1", "", {}, "sha512-test"]
      }
    }`)

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W909")).toBe(true)
  })

  test("does not warn when a workspace app inherits bun.lock from workspace root", async () => {
    const workspaceRoot = join(TMP, "workspace")
    const appRoot = join(workspaceRoot, "apps", "web")
    await mkdir(join(appRoot, "routes"), { recursive: true })
    await mkdir(join(appRoot, "shared"), { recursive: true })
    await mkdir(join(appRoot, "middleware"), { recursive: true })
    await writeFile(join(workspaceRoot, "package.json"), JSON.stringify({
      name: "workspace-root",
      private: true,
      packageManager: "bun@1.3.9",
      workspaces: ["apps/*"],
    }, null, 2))
    await writeFile(join(workspaceRoot, "bun.lock"), `{
      "lockfileVersion": 1,
      "packages": {
        "gorsee": ["gorsee@file:${process.cwd()}", "", {}, "sha512-test"]
      }
    }`)
    await writeFile(join(appRoot, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(appRoot, "package.json"), JSON.stringify({
      name: "@workspace/web",
      private: true,
      dependencies: {
        gorsee: `file:${process.cwd()}`,
        "@workspace/shared": "workspace:*",
      },
    }, null, 2))
    await writeFile(join(appRoot, "routes", "index.tsx"), `export default function Page() { return <main>workspace</main> }`)

    const result = await checkProject({ cwd: appRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W909")).toBe(false)
    expect(result.warnings.some((issue) => issue.code === "W910")).toBe(false)
  })

  test("warns when packageManager is missing or non-exact", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-check-app",
      version: "0.0.0",
      dependencies: {
        devalue: "5.6.3",
      },
    }, null, 2))
    await writeFile(join(TMP, "bun.lock"), `{
      "lockfileVersion": 1,
      "packages": {
        "devalue": ["devalue@5.6.3", "", {}, "sha512-test"]
      }
    }`)

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W910")).toBe(true)
  })

  test("warns when deploy files still contain placeholder APP_ORIGIN values", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "fly.toml"), `
      [env]
      APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W908")).toBe(true)
  })

  test("warns when tsconfig drifts from canonical Gorsee JSX settings", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
      },
    }, null, 2))

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W912")).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W913")).toBe(true)
  })

  test("warns when routes import from root gorsee instead of canonical surfaces", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "root-import.tsx"), `
      import { Head, createAuth } from "gorsee"
      export default function RootImportPage() { return <main>{String(!!Head && !!createAuth)}</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W911" && issue.file.endsWith("root-import.tsx"))).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W927" && issue.file.endsWith("root-import.tsx"))).toBe(true)
  })

  test("warns when domain APIs are imported from gorsee/server instead of scoped entrypoints", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "server-domain-imports.tsx"), `
      import { createAuth, createDB, cors, log, type Context } from "gorsee/server"
      export function GET(ctx: Context) {
        const auth = createAuth({ secret: "test-secret" })
        const db = createDB()
        const middleware = cors()
        log.info("check", { ok: true })
        return Response.json({ ok: !!auth && !!db && !!middleware && !!ctx })
      }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W914" && issue.file.endsWith("server-domain-imports.tsx"))).toBe(true)
  })

  test("warns when routes/forms helpers are imported from gorsee/client instead of scoped entrypoints", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "client-domain-imports.tsx"), `
      import { Head, createTypedRoute, defineForm } from "gorsee/client"
      const usersRoute = createTypedRoute("/users/:id")
      const userForm = defineForm({
        name: (input) => String(input ?? "").trim().length > 0 ? null : "required",
      })
      export default function ClientImportsPage() {
        return <main>{String(!!Head && !!usersRoute && !!userForm)}</main>
      }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W915" && issue.file.endsWith("client-domain-imports.tsx"))).toBe(true)
  })

  test("does not warn when scoped entrypoints are used for domain concerns", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "canonical-imports.tsx"), `
      import { Head } from "gorsee/client"
      import { defineForm } from "gorsee/forms"
      import { createTypedRoute } from "gorsee/routes"
      import { createAuth } from "gorsee/auth"
      import { createDB } from "gorsee/db"
      import { cors } from "gorsee/security"
      import { log } from "gorsee/log"
      const route = createTypedRoute("/reports/:id")
      const form = defineForm({
        name: (input) => String(input ?? "").trim().length > 0 ? null : "required",
      })
      const auth = createAuth({ secret: "test-secret" })
      const db = createDB()
      const middleware = cors()
      log.info("canonical-imports", { ok: true })
      export default function CanonicalImportsPage() {
        return <main>{String(!!Head && !!route && !!form && !!auth && !!db && !!middleware)}</main>
      }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W914" && issue.file.endsWith("canonical-imports.tsx"))).toBe(false)
    expect(result.warnings.some((issue) => issue.code === "W915" && issue.file.endsWith("canonical-imports.tsx"))).toBe(false)
  })

  test("rewrite flags can normalize imports and legacy loader exports before audit", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(TMP, "routes", "rewrite-me.tsx"), `
      import { Head, Link } from "gorsee"
      import { defineForm } from "gorsee/client"
      import { createAuth } from "gorsee/server"
      export async function loader() {
        return { ok: !!createAuth && !!defineForm && !!Head && !!Link }
      }
      export default function RewriteMePage() { return <main>rewrite</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false, rewriteImports: true, rewriteLoaders: true })
    const rewritten = await Bun.file(join(TMP, "routes", "rewrite-me.tsx")).text()

    expect(result.warnings.some((issue) => issue.code === "W914" && issue.file.endsWith("rewrite-me.tsx"))).toBe(false)
    expect(result.warnings.some((issue) => issue.code === "W915" && issue.file.endsWith("rewrite-me.tsx"))).toBe(false)
    expect(result.warnings.some((issue) => issue.code === "W927" && issue.file.endsWith("rewrite-me.tsx"))).toBe(false)
    expect(result.warnings.some((issue) => issue.code === "W916" && issue.file.endsWith("rewrite-me.tsx"))).toBe(false)
    expect(rewritten).toContain('import { Head, Link } from "gorsee/client"')
    expect(rewritten).toContain('import { defineForm } from "gorsee/forms"')
    expect(rewritten).toContain('import { createAuth } from "gorsee/auth"')
    expect(rewritten).toContain("export async function load()")
  })

  test("strictSecurity promotes framework security warnings to errors", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default {}`)
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-check-app",
      version: "0.0.0",
      dependencies: {
        devalue: "^5.1.1",
      },
    }, null, 2))
    await writeFile(join(TMP, "routes", "strict.tsx"), `
      import { server, routeCache, redirect } from "gorsee/server"
      const doThing = server(async () => ({ ok: true }))
      export const cache = routeCache({ maxAge: 60 })
      export async function loader() {
        const nextUrl = new URLSearchParams("next=/dashboard").get("next")
        redirect(nextUrl)
      }
      export default function StrictPage() { return <main>{String(!!doThing)}</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false, strictSecurity: true })

    expect(result.errors.some((issue) => issue.code === "E903")).toBe(true)
    expect(result.errors.some((issue) => issue.code === "E904")).toBe(true)
    expect(result.errors.some((issue) => issue.code === "E905")).toBe(true)
    expect(result.errors.some((issue) => issue.code === "E906")).toBe(true)
    expect(result.errors.some((issue) => issue.code === "E907")).toBe(true)
    expect(result.errors.some((issue) => issue.code === "E908")).toBe(true)
    expect(result.errors.some((issue) => issue.code === "E909")).toBe(true)
    expect(result.errors.some((issue) => issue.code === "E910")).toBe(true)
  })

  test("warns when a multi-instance app uses process-local stateful primitives", async () => {
    const appRoot = join(TMP, "multi-instance-local")
    await rm(appRoot, { recursive: true, force: true })
    await mkdir(join(appRoot, "routes"), { recursive: true })
    await mkdir(join(appRoot, "shared"), { recursive: true })
    await mkdir(join(appRoot, "middleware"), { recursive: true })
    await writeFile(join(appRoot, "package.json"), JSON.stringify({
      name: "multi-instance-local",
      version: "0.0.0",
    }, null, 2))
    await writeFile(join(appRoot, "app.config.ts"), `
      export default {
        runtime: {
          topology: "multi-instance",
        },
        ai: {
          enabled: true,
        },
        security: {
          origin: "https://app.example.com",
        },
      }
    `.trim())
    await writeFile(join(appRoot, "shared", "auth-shared.ts"), `
      import { createMemorySessionStore } from "gorsee/server"
      export const store = createMemorySessionStore()
    `.trim())
    await writeFile(join(appRoot, "shared", "jobs.ts"), `
      import { createMemoryJobQueue } from "gorsee/server"
      export const jobs = createMemoryJobQueue()
    `.trim())
    await writeFile(join(appRoot, "routes", "cached.tsx"), `
      import { routeCache } from "gorsee/server"
      export const cache = routeCache({ maxAge: 60, mode: "private" })
      export default function CachedPage() { return <main>cached</main> }
    `.trim())

    const result = await checkProject({ cwd: appRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W917" && issue.file.endsWith("shared/auth-shared.ts"))).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W918" && issue.file.endsWith("shared/jobs.ts"))).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W919" && issue.file.endsWith("cached.tsx"))).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W920" && issue.file === "app.config.ts")).toBe(true)
    expect(result.warnings.some((issue) => issue.code === "W921" && issue.file === "app.config.ts")).toBe(true)
  })

  test("does not warn for distributed stateful surfaces in a multi-instance app", async () => {
    const appRoot = join(TMP, "multi-instance-distributed")
    await rm(appRoot, { recursive: true, force: true })
    await mkdir(join(appRoot, "routes"), { recursive: true })
    await mkdir(join(appRoot, "shared"), { recursive: true })
    await mkdir(join(appRoot, "middleware"), { recursive: true })
    await writeFile(join(appRoot, "package.json"), JSON.stringify({
      name: "multi-instance-distributed",
      version: "0.0.0",
    }, null, 2))
    await writeFile(join(appRoot, "app.config.ts"), `
      import { createNodeRedisLikeClient, createRedisRateLimiter } from "gorsee/server"

      const memoryRedis = {
        store: new Map(),
        async get(key) { return this.store.get(key) ?? null },
        async set(key, value) { this.store.set(key, value) },
        async del(key) { return this.store.delete(key) ? 1 : 0 },
        async keys(pattern) {
          const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
          return [...this.store.keys()].filter((key) => key.startsWith(prefix))
        },
        async incr(key) {
          const next = Number(this.store.get(key) ?? "0") + 1
          this.store.set(key, String(next))
          return next
        },
        async expire() { return 1 },
        async pttl() { return 60_000 },
        async setnx(key, value) {
          if (this.store.has(key)) return 0
          this.store.set(key, value)
          return 1
        },
      }
      const client = createNodeRedisLikeClient(memoryRedis)

      export default {
        runtime: {
          topology: "multi-instance",
        },
        ai: {
          enabled: true,
          bridge: {
            url: "http://127.0.0.1:4318/gorsee/ai-events",
          },
        },
        security: {
          origin: "https://app.example.com",
          rateLimit: {
            limiter: createRedisRateLimiter(client, 100, "1m"),
          },
        },
      }
    `.trim())
    await writeFile(join(appRoot, "shared", "auth-shared.ts"), `
      import { createNodeRedisLikeClient, createRedisSessionStore } from "gorsee/server"

      const memoryRedis = {
        store: new Map(),
        async get(key) { return this.store.get(key) ?? null },
        async set(key, value) { this.store.set(key, value) },
        async del(key) { return this.store.delete(key) ? 1 : 0 },
        async keys(pattern) {
          const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
          return [...this.store.keys()].filter((key) => key.startsWith(prefix))
        },
      }
      export const store = createRedisSessionStore(createNodeRedisLikeClient(memoryRedis))
    `.trim())
    await writeFile(join(appRoot, "shared", "jobs.ts"), `
      import { createNodeRedisLikeClient, createRedisJobQueue, defineJob } from "gorsee/server"

      const memoryRedis = {
        store: new Map(),
        async get(key) { return this.store.get(key) ?? null },
        async set(key, value) { this.store.set(key, value) },
        async del(key) { return this.store.delete(key) ? 1 : 0 },
        async keys(pattern) {
          const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
          return [...this.store.keys()].filter((key) => key.startsWith(prefix))
        },
        async incr(key) {
          const next = Number(this.store.get(key) ?? "0") + 1
          this.store.set(key, String(next))
          return next
        },
        async expire() { return 1 },
        async setnx(key, value) {
          if (this.store.has(key)) return 0
          this.store.set(key, value)
          return 1
        },
      }
      const queue = createRedisJobQueue(createNodeRedisLikeClient(memoryRedis), {
        jobs: [defineJob("email", async () => undefined)],
      })
      export { queue }
    `.trim())
    await writeFile(join(appRoot, "routes", "cached.tsx"), `
      import { createNodeRedisLikeClient, createRedisCacheStore, routeCache } from "gorsee/server"

      const memoryRedis = {
        store: new Map(),
        async get(key) { return this.store.get(key) ?? null },
        async set(key, value) { this.store.set(key, value) },
        async del(key) { return this.store.delete(key) ? 1 : 0 },
        async keys(pattern) {
          const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
          return [...this.store.keys()].filter((key) => key.startsWith(prefix))
        },
        async expire() { return 1 },
      }
      const store = createRedisCacheStore(createNodeRedisLikeClient(memoryRedis))
      export const cache = routeCache({ maxAge: 60, mode: "private", store })
      export default function CachedPage() { return <main>cached</main> }
    `.trim())

    const result = await checkProject({ cwd: appRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => ["W917", "W918", "W919", "W920", "W921"].includes(issue.code))).toBe(false)
  })

  test("warns when AI observability is enabled without a local AI rules file", async () => {
    const appRoot = join(TMP, "ai-rules-missing")
    await rm(appRoot, { recursive: true, force: true })
    await mkdir(join(appRoot, "routes"), { recursive: true })
    await mkdir(join(appRoot, "shared"), { recursive: true })
    await mkdir(join(appRoot, "middleware"), { recursive: true })
    await writeFile(join(appRoot, "package.json"), JSON.stringify({
      name: "ai-rules-missing",
      version: "0.0.0",
    }, null, 2))
    await writeFile(join(appRoot, "app.config.ts"), `
      export default {
        security: { origin: "https://app.example.com" },
        ai: { enabled: true },
      }
    `.trim())
    await writeFile(join(appRoot, "routes", "index.tsx"), `export default function Page() { return <main>ai</main> }`)

    const result = await checkProject({ cwd: appRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W928" && issue.file === "app.config.ts")).toBe(true)
  })

  test("does not warn about AI rules when .gorsee/rules.md is present", async () => {
    const appRoot = join(TMP, "ai-rules-present")
    await rm(appRoot, { recursive: true, force: true })
    await mkdir(join(appRoot, "routes"), { recursive: true })
    await mkdir(join(appRoot, "shared"), { recursive: true })
    await mkdir(join(appRoot, "middleware"), { recursive: true })
    await mkdir(join(appRoot, ".gorsee"), { recursive: true })
    await writeFile(join(appRoot, ".gorsee", "rules.md"), "# Rules\n\nInspect first.\n")
    await writeFile(join(appRoot, "package.json"), JSON.stringify({
      name: "ai-rules-present",
      version: "0.0.0",
    }, null, 2))
    await writeFile(join(appRoot, "app.config.ts"), `
      export default {
        security: { origin: "https://app.example.com" },
        ai: { enabled: true },
      }
    `.trim())
    await writeFile(join(appRoot, "routes", "index.tsx"), `export default function Page() { return <main>ai</main> }`)

    const result = await checkProject({ cwd: appRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W928")).toBe(false)
  })

  test("warns when latest AI packet is mutating without explicit checkpoint", async () => {
    const appRoot = join(TMP, "ai-mutating-without-checkpoint")
    await rm(appRoot, { recursive: true, force: true })
    await mkdir(join(appRoot, "routes"), { recursive: true })
    await mkdir(join(appRoot, "shared"), { recursive: true })
    await mkdir(join(appRoot, "middleware"), { recursive: true })
    await mkdir(join(appRoot, ".gorsee", "agent"), { recursive: true })
    await writeFile(join(appRoot, "package.json"), JSON.stringify({
      name: "ai-mutating-without-checkpoint",
      version: "0.0.0",
    }, null, 2))
    await writeFile(join(appRoot, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(appRoot, "routes", "index.tsx"), `export default function Page() { return <main>ai</main> }`)
    await writeFile(join(appRoot, ".gorsee", "agent", "latest.json"), JSON.stringify({
      schemaVersion: "1.0",
      agent: {
        currentMode: "operate",
      },
    }, null, 2))

    const result = await checkProject({ cwd: appRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W929" && issue.file === ".gorsee/agent/latest.json")).toBe(true)
  })

  test("does not warn when mutating AI packet has matching checkpoint", async () => {
    const appRoot = join(TMP, "ai-mutating-with-checkpoint")
    await rm(appRoot, { recursive: true, force: true })
    await mkdir(join(appRoot, "routes"), { recursive: true })
    await mkdir(join(appRoot, "shared"), { recursive: true })
    await mkdir(join(appRoot, "middleware"), { recursive: true })
    await mkdir(join(appRoot, ".gorsee", "agent", "checkpoints"), { recursive: true })
    await writeFile(join(appRoot, "package.json"), JSON.stringify({
      name: "ai-mutating-with-checkpoint",
      version: "0.0.0",
    }, null, 2))
    await writeFile(join(appRoot, "app.config.ts"), `export default { security: { origin: "https://app.example.com" } }`)
    await writeFile(join(appRoot, "routes", "index.tsx"), `export default function Page() { return <main>ai</main> }`)
    await writeFile(join(appRoot, ".gorsee", "agent", "latest.json"), JSON.stringify({
      schemaVersion: "1.0",
      agent: {
        currentMode: "apply",
      },
    }, null, 2))
    await writeFile(join(appRoot, ".gorsee", "agent", "checkpoints", "latest.json"), JSON.stringify({
      schemaVersion: "1.0",
      mode: "apply",
    }, null, 2))

    const result = await checkProject({ cwd: appRoot, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W929")).toBe(false)
  })
})
