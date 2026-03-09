import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("build default switch rehearsal", () => {
  test("package scripts expose rehearsal flow", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

        expect(pkg.scripts?.["build:default:rehearsal:check"]).toBe("node scripts/build-default-switch-rehearsal-check.mjs")
  })

  test("rehearsal check validates operator-visible flow", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/build-default-switch-rehearsal-check.mjs"), "utf-8")
    expect(script).toContain("missing build:default:rehearsal script")
    expect(script).toContain("build:default:rehearsal script missing token")
    expect(script).toContain("build:default:rehearsal OK")
  })
})
