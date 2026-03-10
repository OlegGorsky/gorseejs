import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { checkProject, runCheck } from "../../src/cli/cmd-check.ts"
import { generateDeployConfig } from "../../src/cli/cmd-deploy.ts"
import { generateDocs } from "../../src/cli/cmd-docs.ts"
import { generateCrudScaffold } from "../../src/cli/cmd-generate.ts"
import { runProjectMigrations } from "../../src/cli/cmd-migrate.ts"
import { listRoutes } from "../../src/cli/cmd-routes.ts"
import { generateRouteTypes } from "../../src/cli/cmd-typegen.ts"

const TMP = join(process.cwd(), ".tmp-cli-command-runtime")

describe("CLI command runtime coverage", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("listRoutes prints deterministic rows with params", async () => {
    const cwd = join(TMP, "routes-list")
    await mkdir(join(cwd, "routes", "posts"), { recursive: true })
    await writeFile(join(cwd, "routes", "index.tsx"), "export default function Page() { return <main>home</main> }")
    await writeFile(join(cwd, "routes", "posts", "[id].tsx"), "export default function Post() { return <main>post</main> }")

    const originalLog = console.log
    const logs: string[] = []
    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log

    try {
      await listRoutes({ cwd })
    } finally {
      console.log = originalLog
    }

    const output = logs.join("\n")
    expect(output).toContain("Routes:")
    expect(output).toContain("Path")
    expect(output).toContain("/")
    expect(output).toContain("/posts/[id]")
    expect(output).toContain("id")
  })

  test("listRoutes prints explicit empty-state message", async () => {
    const cwd = join(TMP, "routes-empty")
    await mkdir(join(cwd, "routes"), { recursive: true })

    const originalLog = console.log
    const logs: string[] = []
    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log

    try {
      await listRoutes({ cwd })
    } finally {
      console.log = originalLog
    }

    expect(logs.join("\n")).toContain("No routes found in routes/")
  })

  test("generateRouteTypes warns and exits cleanly when no routes exist", async () => {
    const cwd = join(TMP, "typegen-empty")
    await mkdir(join(cwd, "routes"), { recursive: true })

    const originalWarn = console.warn
    const warnings: string[] = []
    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn

    try {
      await generateRouteTypes([], { cwd })
    } finally {
      console.warn = originalWarn
    }

    expect(warnings.join("\n")).toContain("No routes found")
  })

  test("listRoutes and typegen handle grouped routes with inherited layouts deterministically", async () => {
    const cwd = join(TMP, "routes-grouped")
    await mkdir(join(cwd, "routes", "(dashboard)", "posts"), { recursive: true })
    await writeFile(join(cwd, "routes", "(dashboard)", "_layout.tsx"), "export default function Layout(props) { return <section>{props.children()}</section> }")
    await writeFile(join(cwd, "routes", "(dashboard)", "posts", "[id].tsx"), "export default function Post() { return <main>post</main> }")
    await writeFile(join(cwd, "routes", "(dashboard)", "index.tsx"), "export default function Dashboard() { return <main>dashboard</main> }")

    const originalLog = console.log
    const logs: string[] = []
    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log

    try {
      await listRoutes({ cwd })
      await generateRouteTypes([], { cwd })
    } finally {
      console.log = originalLog
    }

    const output = logs.join("\n")
    const declaration = await readFile(join(cwd, ".gorsee", "routes.d.ts"), "utf-8")
    const facts = JSON.parse(await readFile(join(cwd, ".gorsee", "route-facts.json"), "utf-8")) as {
      routes: Array<{ path: string; params: string[]; hasMiddleware: boolean }>
    }

    expect(output).toContain("/posts/[id]")
    expect(output).toContain("routes/(dashboard)/posts/[id].tsx")
    expect(declaration).toContain('"/posts/[id]": { id: string }')
    expect(declaration).toContain('"/": {}')
    expect(facts.routes.map((route) => route.path)).toEqual(["/", "/posts/[id]"])
  })

  test("generateDocs routes-only contracts artifact excludes API routes and preserves summary", async () => {
    const cwd = join(TMP, "docs-routes-only-contracts")
    await mkdir(join(cwd, "routes", "api"), { recursive: true })
    await writeFile(join(cwd, "routes", "index.tsx"), `
      export async function load() {
        return { ok: true }
      }
      export default function HomePage() {
        return <main>home</main>
      }
    `.trim())
    await writeFile(join(cwd, "routes", "reports.tsx"), `
      export const prerender = true
      export default function ReportsPage() {
        return <main>reports</main>
      }
    `.trim())
    await writeFile(join(cwd, "routes", "api", "health.ts"), `
      export async function GET() {
        return new Response("ok")
      }
    `.trim())

    await generateDocs(["--output", "docs/routes-artifact.json", "--format", "json", "--routes-only", "--contracts"], { cwd })

    const artifact = JSON.parse(await readFile(join(cwd, "docs", "routes-artifact.json"), "utf-8")) as {
      schemaVersion: number
      summary: {
        totalRoutes: number
        pageRoutes: number
        apiRoutes: number
        loaderRoutes: number
        middlewareRoutes: number
        prerenderedRoutes: number
      }
      docs: Array<{ path: string; isApi: boolean }>
      routes: Array<{ path: string; isApi: boolean }>
    }

    expect(artifact.schemaVersion).toBe(1)
    expect(artifact.summary).toEqual({
      totalRoutes: 2,
      pageRoutes: 2,
      apiRoutes: 0,
      loaderRoutes: 1,
      middlewareRoutes: 0,
      prerenderedRoutes: 1,
    })
    expect(artifact.docs.map((doc) => doc.path)).toEqual(["/", "/reports"])
    expect(artifact.routes.map((route) => route.path)).toEqual(["/", "/reports"])
    expect(artifact.docs.every((doc) => doc.isApi === false)).toBe(true)
    expect(artifact.routes.every((route) => route.isApi === false)).toBe(true)
  })

  test("generateCrudScaffold honors explicit postgres mode", async () => {
    const cwd = join(TMP, "generate-postgres")
    await mkdir(cwd, { recursive: true })

    await generateCrudScaffold(["categories", "--data", "postgres"], { cwd })

    const repoModule = await readFile(join(cwd, "shared", "categories.ts"), "utf-8")
    const migrationFiles = await readdir(join(cwd, "migrations"))
    const migrationDir = await readFile(join(cwd, "migrations", migrationFiles[0]!), "utf-8")

    expect(repoModule).toContain("createPostgresDB")
    expect(repoModule).toContain("configureCategoryPostgres")
    expect(migrationFiles.length).toBe(1)
    expect(migrationDir).toContain("BIGSERIAL PRIMARY KEY")
    expect(migrationDir).toContain("TIMESTAMPTZ")
  })

  test("generateCrudScaffold infers sqlite mode from app config", async () => {
    const cwd = join(TMP, "generate-sqlite-inferred")
    await mkdir(cwd, { recursive: true })
    await writeFile(join(cwd, "app.config.ts"), `
      export default {
        db: {
          driver: "sqlite",
        },
      }
    `.trim())

    await generateCrudScaffold(["companies"], { cwd })

    const repoModule = await readFile(join(cwd, "shared", "companies.ts"), "utf-8")
    const migrationFiles = await readdir(join(cwd, "migrations"))
    const migrationSql = await readFile(join(cwd, "migrations", migrationFiles[0]!), "utf-8")

    expect(repoModule).toContain('import { createDB } from "gorsee/db"')
    expect(repoModule).toContain("SafeSQL")
    expect(migrationSql).toContain("INTEGER PRIMARY KEY AUTOINCREMENT")
    expect(migrationSql).not.toContain("BIGSERIAL")
  })

  test("runCheck in strict mode promotes security warnings to errors and exits non-zero", async () => {
    const cwd = join(TMP, "check-strict")
    await mkdir(join(cwd, "routes"), { recursive: true })
    await writeFile(join(cwd, "app.config.ts"), `
      export default {
        security: {
          origin: "https://app.example.com",
        },
      }
    `.trim())
    await writeFile(join(cwd, "routes", "index.tsx"), `
      import { server } from "gorsee/server"
      const doThing = server(async () => ({ ok: true }))
      export default function Page() {
        return <main>{String(!!doThing)}</main>
      }
    `.trim())

    const baseline = await checkProject({ cwd, runTypeScript: false })
    expect(baseline.warnings.some((issue) => issue.code === "W903")).toBe(true)

    const originalExit = process.exit
    const originalLog = console.log
    const logs: string[] = []
    let exitCode = 0

    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error("process.exit")
    }) as typeof process.exit

    try {
      await expect(runCheck(["--strict"], { cwd, runTypeScript: false })).rejects.toThrow("process.exit")
    } finally {
      process.exit = originalExit
      console.log = originalLog
    }

    const output = logs.join("\n")
    expect(exitCode).toBe(1)
    expect(output).toContain("Security strict mode: enabled")
    expect(output).toContain("[ERROR] E903")
    expect(output).toContain("Result: FAIL (1 error(s), 0 warning(s))")
  })

  test("generateDeployConfig auto-detects target and reports init-only mode", async () => {
    const cwd = join(TMP, "deploy-autodetect-init")
    await mkdir(cwd, { recursive: true })
    await writeFile(join(cwd, "package.json"), JSON.stringify({
      name: "deploy-autodetect-init",
      type: "module",
      packageManager: "bun@1.3.9",
    }, null, 2))
    await writeFile(join(cwd, "Dockerfile"), "FROM scratch\n")

    const originalLog = console.log
    const logs: string[] = []
    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log

    try {
      await generateDeployConfig(["--init"], { cwd })
    } finally {
      console.log = originalLog
    }

    const dockerfile = await readFile(join(cwd, "Dockerfile"), "utf-8")
    const output = logs.join("\n")
    expect(output).toContain("Auto-detected target: docker")
    expect(output).toContain("Config generated (--init mode). Deploy manually when ready.")
    expect(dockerfile).toContain("ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN")
    expect(dockerfile).toContain('CMD ["bun", "run", "start"]')
  })

  test("generateCrudScaffold exits with usage when entity is missing", async () => {
    const originalExit = process.exit
    const originalError = console.error
    const errors: string[] = []
    let exitCode = 0

    console.error = ((message?: unknown) => {
      errors.push(String(message ?? ""))
    }) as typeof console.error
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error("process.exit")
    }) as typeof process.exit

    try {
      await expect(generateCrudScaffold([], { cwd: TMP })).rejects.toThrow("process.exit")
    } finally {
      process.exit = originalExit
      console.error = originalError
    }

    expect(exitCode).toBe(1)
    expect(errors.join("\n")).toContain("Usage: gorsee generate <entity-name>")
  })

  test("runProjectMigrations create writes a sanitized migration file", async () => {
    const cwd = join(TMP, "migrate-create")
    await mkdir(cwd, { recursive: true })

    const originalLog = console.log
    const logs: string[] = []
    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log

    try {
      await runProjectMigrations(["create", "Create Posts!"], { cwd })
    } finally {
      console.log = originalLog
    }

    const files = await readdir(join(cwd, "migrations"))
    expect(files).toHaveLength(1)
    expect(files[0]).toContain("create_posts")
    expect(logs.join("\n")).toContain("Created: migrations/")
  })

  test("runProjectMigrations apply path reports applied and skipped migrations", async () => {
    const cwd = join(TMP, "migrate-apply")
    await mkdir(join(cwd, "migrations"), { recursive: true })
    await writeFile(join(cwd, "migrations", "001_create_users.sql"), `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL
      );
    `.trim())

    const originalLog = console.log
    const logs: string[] = []
    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log

    try {
      await runProjectMigrations([], { cwd, dbPath: join(cwd, "data.sqlite") })
      await runProjectMigrations([], { cwd, dbPath: join(cwd, "data.sqlite") })
    } finally {
      console.log = originalLog
    }

    const output = logs.join("\n")
    expect(output).toContain("Running migrations...")
    expect(output).toContain("Applied:")
    expect(output).toContain("001_create_users.sql")
    expect(output).toContain("Skipped: 1")
  })

  test("runProjectMigrations apply exits with errors for invalid SQL migrations", async () => {
    const cwd = join(TMP, "migrate-invalid-sql")
    await mkdir(join(cwd, "migrations"), { recursive: true })
    await writeFile(join(cwd, "migrations", "001_broken.sql"), "THIS IS NOT SQL;")

    const originalExit = process.exit
    const originalError = console.error
    const originalLog = console.log
    const logs: string[] = []
    const errors: string[] = []
    let exitCode = 0

    console.log = ((message?: unknown) => {
      logs.push(String(message ?? ""))
    }) as typeof console.log
    console.error = ((message?: unknown) => {
      errors.push(String(message ?? ""))
    }) as typeof console.error
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error("process.exit")
    }) as typeof process.exit

    try {
      await expect(runProjectMigrations([], { cwd, dbPath: join(cwd, "data.sqlite") })).rejects.toThrow("process.exit")
    } finally {
      process.exit = originalExit
      console.error = originalError
      console.log = originalLog
    }

    expect(exitCode).toBe(1)
    expect(logs.join("\n")).toContain("Running migrations...")
    expect(logs.join("\n")).toContain("Errors:")
    expect(errors.join("\n")).toContain("001_broken.sql")
  })

  test("runProjectMigrations create exits with usage when name is missing", async () => {
    const originalExit = process.exit
    const originalError = console.error
    const errors: string[] = []
    let exitCode = 0

    console.error = ((message?: unknown) => {
      errors.push(String(message ?? ""))
    }) as typeof console.error
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error("process.exit")
    }) as typeof process.exit

    try {
      await expect(runProjectMigrations(["create"], { cwd: TMP })).rejects.toThrow("process.exit")
    } finally {
      process.exit = originalExit
      console.error = originalError
    }

    expect(exitCode).toBe(1)
    expect(errors.join("\n")).toContain("Usage: gorsee migrate create <migration-name>")
  })

  test("generateDocs markdown output and explicit deploy target work on the same fixture app", async () => {
    const cwd = join(TMP, "docs-markdown-deploy-explicit")
    await mkdir(join(cwd, "routes"), { recursive: true })
    await writeFile(join(cwd, "routes", "index.tsx"), "export default function Page() { return <main>home</main> }")

    await generateDocs(["--output", "docs/api.md", "--format", "markdown"], { cwd })
    await generateDeployConfig(["--target", "vercel", "--init"], { cwd })

    const docs = await readFile(join(cwd, "docs", "api.md"), "utf-8")
    const deploy = await readFile(join(cwd, "vercel.json"), "utf-8")

    expect(docs).toContain("# API Documentation")
    expect(docs).toContain("| / | GET | Page | - | - |")
    expect(deploy).toContain("\"version\": 2")
  })
})
