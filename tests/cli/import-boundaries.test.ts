import { afterAll, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm } from "node:fs/promises"
import { basename, join } from "node:path"
import { runCreate } from "../../src/cli/cmd-create.ts"
import { parseGenerateFlags, runGenerate } from "../../src/cli/cmd-generate.ts"
import { generateFrameworkMD } from "../../src/cli/framework-md.ts"

const CREATE_APP_DIR = join(process.cwd(), ".tmp-import-boundaries-app")
const GENERATE_APP_DIR = join(process.cwd(), ".tmp-import-boundaries-generate")

afterAll(async () => {
  await rm(CREATE_APP_DIR, { recursive: true, force: true })
  await rm(GENERATE_APP_DIR, { recursive: true, force: true })
})

describe("CLI import boundaries", () => {
  test("runCreate scaffolds only client/server entrypoint imports", async () => {
    await rm(CREATE_APP_DIR, { recursive: true, force: true })
    const originalCwd = process.cwd()
    const appName = basename(CREATE_APP_DIR)
    try {
      await runCreate([appName])
      const appDir = join(originalCwd, appName)
      const indexRoute = await readFile(join(appDir, "routes/index.tsx"), "utf-8")
      const aboutRoute = await readFile(join(appDir, "routes/about.tsx"), "utf-8")
      const apiRoute = await readFile(join(appDir, "routes/api/health.ts"), "utf-8")
      const readme = await readFile(join(appDir, "README.md"), "utf-8")
      const gitignore = await readFile(join(appDir, ".gitignore"), "utf-8")
      const packageJson = JSON.parse(await readFile(join(appDir, "package.json"), "utf-8")) as {
        devDependencies?: Record<string, string>
      }

      expect(indexRoute).toContain(`from "gorsee/client"`)
      expect(aboutRoute).toContain(`from "gorsee/client"`)
      expect(apiRoute).toContain(`from "gorsee/server"`)
      expect(indexRoute).not.toMatch(/from "gorsee"(?!\/)/)
      expect(aboutRoute).not.toMatch(/from "gorsee"(?!\/)/)
      expect(apiRoute).not.toMatch(/from "gorsee"(?!\/)/)
      expect(readme).toContain("AI-first reactive full-stack TypeScript framework")
      expect(readme).toContain("Treat this app as a product codebase")
      expect(readme).toContain("Keep `bun.lock` in version control after the first `bun install`.")
      expect(readme).toContain("Use `gorsee/server` for `load`, `action`, middleware, cache, RPC, and route execution.")
      expect(readme).toContain("Use scoped entrypoints such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/env`, and `gorsee/log`")
      expect(readme).toContain("Do not use root `gorsee` in new code")
      expect(readme).toContain("docs/AI_ARTIFACT_CONTRACT.md")
      expect(readme).toContain("docs/CANONICAL_RECIPES.md")
      expect(gitignore).not.toContain("bun.lock")
      expect(packageJson.devDependencies?.["@types/bun"]).toBe("1.3.10")
    } finally {
      process.chdir(originalCwd)
      await rm(join(originalCwd, appName), { recursive: true, force: true })
    }
  })

  test("runCreate supports first-party secure-saas starter", async () => {
    await rm(CREATE_APP_DIR, { recursive: true, force: true })
    const originalCwd = process.cwd()
    const appName = basename(CREATE_APP_DIR)
    try {
      await runCreate([appName, "--template", "secure-saas"])
      const appDir = join(originalCwd, appName)
      const authShared = await readFile(join(appDir, "auth-shared.ts"), "utf-8")
      const dashboard = await readFile(join(appDir, "routes/app/dashboard.tsx"), "utf-8")
      const readme = await readFile(join(appDir, "README.md"), "utf-8")
      const gitignore = await readFile(join(appDir, ".gitignore"), "utf-8")
      const pkg = JSON.parse(await readFile(join(appDir, "package.json"), "utf-8")) as {
        name: string
        scripts: Record<string, string>
        dependencies: Record<string, string>
      }

      expect(authShared).toContain(`from "gorsee/auth"`)
      expect(dashboard).toContain("dashboard:")
      expect(readme).toContain("Keep `bun.lock` in version control after the first `bun install`.")
      expect(gitignore).not.toContain("bun.lock")
      expect(pkg.name).toBe(appName)
      expect(pkg.scripts.dev).toBe("gorsee dev")
      expect(pkg.dependencies.gorsee).toBe("latest")
    } finally {
      process.chdir(originalCwd)
      await rm(join(originalCwd, appName), { recursive: true, force: true })
    }
  })

  test("runCreate supports first-party content-site starter", async () => {
    await rm(CREATE_APP_DIR, { recursive: true, force: true })
    const originalCwd = process.cwd()
    const appName = basename(CREATE_APP_DIR)
    try {
      await runCreate([appName, "--template", "content-site"])
      const appDir = join(originalCwd, appName)
      const middleware = await readFile(join(appDir, "routes/_middleware.ts"), "utf-8")
      const blogRoute = await readFile(join(appDir, "routes/blog/[slug].tsx"), "utf-8")
      const readme = await readFile(join(appDir, "README.md"), "utf-8")

      expect(middleware).toContain(`from "gorsee/server"`)
      expect(blogRoute).toContain("article:")
      expect(readme).toContain("Template: `content-site`")
    } finally {
      process.chdir(originalCwd)
      await rm(join(originalCwd, appName), { recursive: true, force: true })
    }
  })

  test("runCreate supports first-party agent-aware-ops starter", async () => {
    await rm(CREATE_APP_DIR, { recursive: true, force: true })
    const originalCwd = process.cwd()
    const appName = basename(CREATE_APP_DIR)
    try {
      await runCreate([appName, "--template", "agent-aware-ops"])
      const appDir = join(originalCwd, appName)
      const appConfig = await readFile(join(appDir, "app.config.ts"), "utf-8")
      const opsRoute = await readFile(join(appDir, "routes/ops.tsx"), "utf-8")
      const gitignore = await readFile(join(appDir, ".gitignore"), "utf-8")

      expect(appConfig).toContain("enabled: true")
      expect(appConfig).toContain('jsonlPath: ".gorsee/ai-events.jsonl"')
      expect(opsRoute).toContain("gorsee ai mcp")
      expect(gitignore).not.toContain("bun.lock")
    } finally {
      process.chdir(originalCwd)
      await rm(join(originalCwd, appName), { recursive: true, force: true })
    }
  })

  test("runCreate supports first-party workspace-monorepo starter", async () => {
    await rm(CREATE_APP_DIR, { recursive: true, force: true })
    const originalCwd = process.cwd()
    const appName = basename(CREATE_APP_DIR)
    try {
      await runCreate([appName, "--template", "workspace-monorepo"])
      const appDir = join(originalCwd, appName)
      const rootPackage = JSON.parse(await readFile(join(appDir, "package.json"), "utf-8")) as {
        workspaces: string[]
      }
      const webPackage = JSON.parse(await readFile(join(appDir, "apps/web/package.json"), "utf-8")) as {
        name: string
        dependencies: Record<string, string>
      }
      const readme = await readFile(join(appDir, "README.md"), "utf-8")
      const gitignore = await readFile(join(appDir, ".gitignore"), "utf-8")
      const sharedPackage = JSON.parse(await readFile(join(appDir, "packages/shared/package.json"), "utf-8")) as {
        name: string
      }
      const route = await readFile(join(appDir, "apps/web/routes/index.tsx"), "utf-8")

      expect(rootPackage.workspaces).toEqual(["apps/*", "packages/*"])
      expect(webPackage.name).toBe("@workspace/web")
      expect(webPackage.dependencies.gorsee).toBe("latest")
      expect(webPackage.dependencies["@workspace/shared"]).toBe("workspace:*")
      expect(sharedPackage.name).toBe("@workspace/shared")
      expect(route).toContain(`from "@workspace/shared"`)
      expect(readme).toContain("Keep `bun.lock` in version control after the first `bun install`.")
      expect(gitignore).not.toContain("bun.lock")
    } finally {
      process.chdir(originalCwd)
      await rm(join(originalCwd, appName), { recursive: true, force: true })
    }
  })

  test("runCreate rejects unknown template names", async () => {
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
      await expect(runCreate(["bad-app", "--template", "unknown-shape"])).rejects.toThrow("process.exit")
      expect(exitCode).toBe(1)
      expect(errors.join("\n")).toContain("Unknown template: unknown-shape")
      expect(errors.join("\n")).toContain("workspace-monorepo")
    } finally {
      process.exit = originalExit
      console.error = originalError
    }
  })

  test("runGenerate scaffolds CRUD routes with client/server entrypoints only", async () => {
    await rm(GENERATE_APP_DIR, { recursive: true, force: true })
    const originalCwd = process.cwd()
    await mkdir(GENERATE_APP_DIR, { recursive: true })
    process.chdir(GENERATE_APP_DIR)
    try {
      await runGenerate(["posts"])
      const listRoute = await readFile(join(GENERATE_APP_DIR, "routes/posts/index.tsx"), "utf-8")
      const detailRoute = await readFile(join(GENERATE_APP_DIR, "routes/posts/[id].tsx"), "utf-8")
      const newRoute = await readFile(join(GENERATE_APP_DIR, "routes/posts/new.tsx"), "utf-8")
      const repoModule = await readFile(join(GENERATE_APP_DIR, "shared/posts.ts"), "utf-8")

      for (const content of [listRoute, detailRoute, newRoute]) {
        expect(content).not.toMatch(/from "gorsee"(?!\/)/)
      }
      expect(listRoute).toContain(`from "gorsee/client"`)
      expect(listRoute).not.toContain(`from "gorsee/server"`)
      expect(listRoute).toContain("export async function load()")
      expect(detailRoute).toContain(`from "gorsee/client"`)
      expect(detailRoute).toContain(`from "gorsee/server"`)
      expect(detailRoute).toContain("export async function load(ctx: Context)")
      expect(newRoute).toContain(`from "gorsee/client"`)
      expect(newRoute).toContain(`from "gorsee/forms"`)
      expect(newRoute).not.toContain(`from "gorsee/server"`)
      expect(newRoute).toContain("defineFormAction")
      expect(listRoute).toContain("postRoutes")
      expect(listRoute).toContain("<Link href={postRoutes.create}>")
      expect(listRoute).toContain('<Link href={postRoutes.detail} params={{ id: String(item.id) }}>')
      expect(detailRoute).toContain('<Link href={postRoutes.list}>')
      expect(repoModule).toContain(`from "gorsee/forms"`)
      expect(repoModule).toContain(`from "gorsee/routes"`)
      expect(repoModule).toContain("defineForm")
      expect(repoModule).toContain("createTypedRoute")
      expect(newRoute).not.toContain("TODO")
      expect(listRoute).not.toContain("TODO")
      expect(detailRoute).not.toContain("TODO")
    } finally {
      process.chdir(originalCwd)
    }
  })

  test("parseGenerateFlags supports explicit data mode", () => {
    expect(parseGenerateFlags(["posts", "--data", "postgres"])).toEqual({
      entity: "posts",
      data: "postgres",
    })
  })

  test("runGenerate can scaffold sqlite-backed CRUD contracts", async () => {
    await rm(GENERATE_APP_DIR, { recursive: true, force: true })
    const originalCwd = process.cwd()
    await mkdir(GENERATE_APP_DIR, { recursive: true })
    process.chdir(GENERATE_APP_DIR)
    try {
      await runGenerate(["posts", "--data", "sqlite"])
      const repoModule = await readFile(join(GENERATE_APP_DIR, "shared/posts.ts"), "utf-8")

      expect(repoModule).toContain('from "gorsee/db"')
      expect(repoModule).toContain('from "gorsee/types"')
      expect(repoModule).toContain("createDB")
      expect(repoModule).toContain("SafeSQL")
    } finally {
      process.chdir(originalCwd)
    }
  })

  test("framework guidance marks root gorsee as compatibility-only", () => {
    const frameworkMd = generateFrameworkMD("test-app")
    expect(frameworkMd).toContain("Root `gorsee` is compatibility-only")
    expect(frameworkMd).toContain("`gorsee/compat` is available as an explicit legacy migration entrypoint")
    expect(frameworkMd).toContain("AI-first reactive full-stack framework")
    expect(frameworkMd).toContain("not a pet project")
    expect(frameworkMd).toContain("docs/CANONICAL_RECIPES.md")
    expect(frameworkMd).toContain("docs/API_STABILITY.md")
  })

  test("event source lives on the runtime/client side, not inside server SSE module", async () => {
    const serverSSE = await readFile(join(process.cwd(), "src/server/sse.ts"), "utf-8")
    const clientEntry = await readFile(join(process.cwd(), "src/client.ts"), "utf-8")
    const runtimeEventSource = await readFile(join(process.cwd(), "src/runtime/event-source.ts"), "utf-8")

    expect(serverSSE).not.toContain("export function createEventSource")
    expect(clientEntry).toContain(`./runtime/event-source.ts`)
    expect(runtimeEventSource).toContain("export function createEventSource")
  })
})
