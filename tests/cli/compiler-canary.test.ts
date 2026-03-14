import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("compiler canary workflow", () => {
  test("package scripts expose canonical compiler verification flow", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["compiler:canary"]).toBe(
      "bun scripts/compiler-backend-parity.mjs && bun test tests/cli/programmatic-runtime.test.ts tests/compiler/init.test.ts",
    )
  })

  test("compiler canary policy script validates canary workflow contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/compiler-canary-check.mjs"), "utf-8")
    expect(script).toContain("missing compiler:canary script")
        expect(script).toContain("tests/cli/programmatic-runtime.test.ts")
    expect(script).toContain("compiler:canary OK")
  })
})
