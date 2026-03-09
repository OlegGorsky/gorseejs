import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("backend candidate evidence", () => {
  test("package scripts expose unified candidate evidence train", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["backend:candidate:evidence:verify"]).toContain("compiler:evidence:verify")
    expect(pkg.scripts?.["backend:candidate:evidence:verify"]).toContain("build:evidence:verify")
    expect(pkg.scripts?.["backend:candidate:verify"]).toContain("backend:candidate:evidence:verify")
  })

  test("candidate evidence check validates unified evidence contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/backend-candidate-evidence-check.mjs"), "utf-8")
    expect(script).toContain("missing backend:candidate:evidence:verify script")
    expect(script).toContain("backend:candidate:evidence:verify script missing token")
    expect(script).toContain("backend:candidate:evidence OK")
  })
})
