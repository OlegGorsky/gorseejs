import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("compiler switch dossier", () => {
  test("package scripts expose compiler dossier check", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["compiler:dossier:check"]).toBe("node scripts/compiler-dossier-check.mjs")
    expect(pkg.scripts?.["compiler:evidence:verify"]).toContain("scripts/compiler-promotion-check.mjs")
  })

  test("compiler dossier check validates concrete evidence references", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/compiler-dossier-check.mjs"), "utf-8")
    expect(script).toContain("missing compiler dossier script")
    expect(script).toContain("Compiler dossier missing token")
    expect(script).toContain("compiler:dossier OK")
  })
})
