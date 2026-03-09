import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("build canary workflow", () => {
  test("package scripts expose canonical build verification flow", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["build:canary"]).toBe(
      "bun scripts/build-backend-parity.mjs && bun test tests/cli/programmatic-runtime.test.ts tests/build/init.test.ts tests/integration/production-backend-parity.test.ts",
    )
  })

  test("build canary policy script validates canary workflow contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/build-canary-check.mjs"), "utf-8")
    expect(script).toContain("missing build:canary script")
    expect(script).toContain("tests/cli/programmatic-runtime.test.ts")
    expect(script).toContain("tests/integration/production-backend-parity.test.ts")
    expect(script).toContain("build:canary OK")
  })
})
