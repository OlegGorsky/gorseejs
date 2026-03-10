import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { generateFrameworkMD } from "../../src/cli/framework-md.ts"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("API stability contract", () => {
  test("package and verify surface expose API stability gate", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["api:policy"]).toContain("api-stability-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run api:policy")
  })

  test("package exports keep canonical client/server entrypoints and compatibility root", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      exports: Record<string, string>
    }

    expect(pkg.exports["."]).toBe("./src/index.ts")
    expect(pkg.exports["./compat"]).toBe("./src/compat.ts")
    expect(pkg.exports["./client"]).toBe("./src/client.ts")
    expect(pkg.exports["./server"]).toBe("./src/server-entry.ts")
    expect(pkg.exports["./forms"]).toBe("./src/forms/index.ts")
    expect(pkg.exports["./routes"]).toBe("./src/routes/index.ts")
  })

  test("README and API stability policy describe root gorsee as compatibility-only", async () => {
    const readme = await readFile(join(REPO_ROOT, "README.md"), "utf-8")
    const apiStability = await readFile(join(REPO_ROOT, "docs/API_STABILITY.md"), "utf-8")
    const surfaceMap = await readFile(join(REPO_ROOT, "docs/PUBLIC_SURFACE_MAP.md"), "utf-8")
    const manifest = JSON.parse(await readFile(join(REPO_ROOT, "docs/PUBLIC_SURFACE_MANIFEST.json"), "utf-8")) as {
      version: number
      entrypoints: Array<{ specifier: string; tier: string; source: string }>
    }

    expect(readme).toContain("Keep root `gorsee` only for compatibility")
    expect(readme).toContain("bun run api:policy")
    expect(apiStability).toContain("root `gorsee` is compatibility-only")
    expect(apiStability).toContain("`gorsee/compat` is the explicit compatibility entrypoint")
    expect(apiStability).toContain("`gorsee/client` is stable and preferred")
    expect(apiStability).toContain("`gorsee/server` is stable and preferred")
    expect(apiStability).toContain("`docs/PUBLIC_SURFACE_MANIFEST.json` is the machine-readable canonical export map")
    expect(surfaceMap).toContain("`gorsee/client`")
    expect(surfaceMap).toContain("`gorsee/server`")
    expect(surfaceMap).toContain("`gorsee/compat`")
    expect(surfaceMap).toContain("`gorsee/ai`")
    expect(surfaceMap).toContain("`gorsee/forms`")
    expect(surfaceMap).toContain("`gorsee/routes`")
    expect(surfaceMap).toContain("`docs/PUBLIC_SURFACE_MANIFEST.json`")
    expect(manifest.version).toBe(1)
    expect(manifest.entrypoints).toEqual(expect.arrayContaining([
      { specifier: "gorsee", tier: "compatibility", source: "./src/index.ts" },
      { specifier: "gorsee/compat", tier: "compatibility", source: "./src/compat.ts" },
      { specifier: "gorsee/client", tier: "stable", source: "./src/client.ts" },
      { specifier: "gorsee/server", tier: "stable", source: "./src/server-entry.ts" },
      { specifier: "gorsee/auth", tier: "stable", source: "./src/auth/index.ts" },
      { specifier: "gorsee/forms", tier: "stable", source: "./src/forms/index.ts" },
      { specifier: "gorsee/routes", tier: "stable", source: "./src/routes/index.ts" },
    ]))
  })

  test("generated FRAMEWORK.md teaches canonical scoped imports for domain surfaces", () => {
    const frameworkMd = generateFrameworkMD("example-app")

    expect(frameworkMd).toContain('import { server, middleware, type Context } from "gorsee/server"')
    expect(frameworkMd).toContain('import { createDB } from "gorsee/db"')
    expect(frameworkMd).toContain('import { createAuth } from "gorsee/auth"')
    expect(frameworkMd).toContain('import { cors } from "gorsee/security"')
    expect(frameworkMd).toContain('import { log } from "gorsee/log"')
    expect(frameworkMd).toContain('prefer scoped subpaths such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/env`, and `gorsee/log`')
    expect(frameworkMd).toContain('import { createAuth } from "gorsee/auth"')
    expect(frameworkMd).toContain('import { createCSRFMiddleware } from "gorsee/security"')
    expect(frameworkMd).toContain("### Route Action")
    expect(frameworkMd).toContain('import { defineForm, defineFormAction } from "gorsee/forms"')
    expect(frameworkMd).toContain("export const action = defineFormAction")
    expect(frameworkMd).not.toContain('import { server, middleware, type Context, createDB, createAuth, cors, log } from "gorsee/server"')
    expect(frameworkMd).not.toContain('import { createAuth, createCSRFMiddleware, handleRPCRequestWithPolicy } from "gorsee/server"')
    expect(frameworkMd).not.toContain("### Server Function")
  })
})
