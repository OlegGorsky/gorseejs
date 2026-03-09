import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("backend promotion workflow", () => {
  test("package scripts expose compiler/build promotion checks", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["compiler:promotion:check"]).toBe("node scripts/compiler-promotion-check.mjs")
    expect(pkg.scripts?.["build:promotion:check"]).toBe("node scripts/build-promotion-check.mjs")
  })

  test("compiler promotion script validates promotion gate contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/compiler-promotion-check.mjs"), "utf-8")
    expect(script).toContain("missing ${name} script")
    expect(script).toContain("compiler:parity")
    expect(script).toContain("compiler:canary")
    expect(script).toContain("compiler:promotion OK")
  })

  test("build promotion script validates promotion gate contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/build-promotion-check.mjs"), "utf-8")
    expect(script).toContain("missing ${name} script")
    expect(script).toContain("build:parity")
    expect(script).toContain("build:canary")
    expect(script).toContain("build:promotion OK")
  })
})
