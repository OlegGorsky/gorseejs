import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("compiler switch evidence", () => {
  test("package scripts expose compiler evidence train", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["compiler:evidence:verify"]).toContain("compiler:parity")
        expect(pkg.scripts?.["compiler:evidence:verify"]).toContain("tests/cli/cmd-docs.test.ts")
    expect(pkg.scripts?.["compiler:evidence:verify"]).toContain("tests/cli/cmd-check.test.ts")
  })

  test("compiler evidence check validates the evidence train contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/compiler-evidence-check.mjs"), "utf-8")
    expect(script).toContain("missing compiler:evidence:verify script")
    expect(script).toContain("compiler:evidence:verify script missing token")
    expect(script).toContain("compiler:evidence OK")
  })
})
