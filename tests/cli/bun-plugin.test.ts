import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { resolveFrameworkImport } from "../../src/cli/bun-plugin.ts"
import { resolveClientFrameworkImport } from "../../src/build/framework-imports.ts"

const REPO_ROOT = resolve(import.meta.dir, "../..")

describe("bun-plugin export map parity", () => {
  test("resolves explicit compatibility entrypoint", () => {
    expect(resolveFrameworkImport("gorsee")).toBe(resolve(REPO_ROOT, "src/index.ts"))
    expect(resolveFrameworkImport("gorsee/compat")).toBe(resolve(REPO_ROOT, "src/compat.ts"))
  })

  test("resolves client and server entrypoints", () => {
    expect(resolveFrameworkImport("gorsee/client")).toBe(resolve(REPO_ROOT, "src/client.ts"))
    expect(resolveFrameworkImport("gorsee/server")).toBe(resolve(REPO_ROOT, "src/server-entry.ts"))
  })

  test("resolves client build mapping with browser-safe root entrypoint", () => {
    expect(resolveClientFrameworkImport("gorsee")).toBe(resolve(REPO_ROOT, "src/index-client.ts"))
    expect(resolveClientFrameworkImport("gorsee/client")).toBe(resolve(REPO_ROOT, "src/client.ts"))
    expect(resolveClientFrameworkImport("gorsee/jsx-runtime")).toBe(resolve(REPO_ROOT, "src/jsx-runtime-client.ts"))
  })

  test("covers all package exports that Bun plugin is expected to resolve", async () => {
    const packageJson = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      exports: Record<string, string>
    }

    for (const key of Object.keys(packageJson.exports)) {
      if (key === ".") {
        expect(resolveFrameworkImport("gorsee")).toBeDefined()
        continue
      }

      const specifier = `gorsee/${key.slice(2)}`
      expect(resolveFrameworkImport(specifier)).toBeDefined()
    }
  })

  test("returns undefined for unknown subpaths", () => {
    expect(resolveFrameworkImport("gorsee/does-not-exist")).toBeUndefined()
  })
})
