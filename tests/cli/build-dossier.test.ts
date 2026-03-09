import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("build switch dossier", () => {
  test("package scripts expose build dossier check", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["build:dossier:check"]).toBe("node scripts/build-dossier-check.mjs")
    expect(pkg.scripts?.["build:evidence:verify"]).toContain("scripts/build-promotion-check.mjs")
  })

  test("build dossier check validates concrete evidence references", async () => {
    const dossier = await readFile(join(REPO_ROOT, "docs", "BUILD_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")
    const script = await readFile(join(REPO_ROOT, "scripts/build-dossier-check.mjs"), "utf-8")
    expect(dossier).toContain("emitted output surface parity")
    expect(dossier).toContain("tests/build/client-backend-parity.test.ts")
    expect(script).toContain("missing build dossier script")
    expect(script).toContain("Build dossier missing token")
    expect(script).toContain("build:dossier OK")
  })
})
