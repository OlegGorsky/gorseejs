import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("compiler default switch rehearsal", () => {
  test("package scripts expose rehearsal flow", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

        expect(pkg.scripts?.["compiler:default:rehearsal:check"]).toBe("node scripts/compiler-default-switch-rehearsal-check.mjs")
  })

  test("rehearsal check validates operator-visible flow", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/compiler-default-switch-rehearsal-check.mjs"), "utf-8")
    expect(script).toContain("missing compiler:default:rehearsal script")
    expect(script).toContain("compiler:default:rehearsal script missing token")
    expect(script).toContain("compiler:default:rehearsal OK")
  })
})
