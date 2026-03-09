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
      import { Head } from "gorsee"
      export default function RootImportPage() { return <main>{String(!!Head)}</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false })

    expect(result.warnings.some((issue) => issue.code === "W911" && issue.file.endsWith("root-import.tsx"))).toBe(true)
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
      import { Head, defineForm } from "gorsee/client"
      import { createAuth } from "gorsee/server"
      export async function loader() {
        return { ok: !!createAuth && !!defineForm && !!Head }
      }
      export default function RewriteMePage() { return <main>rewrite</main> }
    `.trim())

    const result = await checkProject({ cwd: TMP, runTypeScript: false, rewriteImports: true, rewriteLoaders: true })
    const rewritten = await Bun.file(join(TMP, "routes", "rewrite-me.tsx")).text()

    expect(result.warnings.some((issue) => issue.code === "W914" && issue.file.endsWith("rewrite-me.tsx"))).toBe(false)
    expect(result.warnings.some((issue) => issue.code === "W915" && issue.file.endsWith("rewrite-me.tsx"))).toBe(false)
    expect(result.warnings.some((issue) => issue.code === "W916" && issue.file.endsWith("rewrite-me.tsx"))).toBe(false)
    expect(rewritten).toContain('import { Head } from "gorsee/client"')
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
})
