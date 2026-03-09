import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("build switch evidence", () => {
  test("package scripts expose build evidence train", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["build:evidence:verify"]).toContain("build:parity")
    expect(pkg.scripts?.["build:evidence:verify"]).toContain("tests/build/artifact-parity.test.ts")
    expect(pkg.scripts?.["build:evidence:verify"]).toContain("tests/build/build-diagnostics.test.ts")
    expect(pkg.scripts?.["build:evidence:verify"]).toContain("tests/integration/production-backend-parity.test.ts")
  })

  test("build evidence check validates the evidence train contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/build-evidence-check.mjs"), "utf-8")
    expect(script).toContain("missing build:evidence:verify script")
    expect(script).toContain("build:evidence:verify script missing token")
    expect(script).toContain("build:evidence OK")
  })
})
