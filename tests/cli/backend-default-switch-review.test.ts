import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("backend default switch review", () => {
  test("package scripts expose unified review check", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["backend:default-switch:review:check"]).toBe("node scripts/backend-default-switch-review-check.mjs")
    expect(pkg.scripts?.["compiler:default:rehearsal:check"]).toBe("node scripts/compiler-default-switch-rehearsal-check.mjs")
    expect(pkg.scripts?.["build:default:rehearsal:check"]).toBe("node scripts/build-default-switch-rehearsal-check.mjs")
  })

  test("review script validates unified operator packet", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/backend-default-switch-review-check.mjs"), "utf-8")
    expect(script).toContain("missing backend default switch review script")
    expect(script).toContain("Backend default switch review missing token")
    expect(script).toContain("backend:default-switch:review OK")
  })

  test("review doc keeps explicit unified no-go state", async () => {
    const doc = await readFile(join(REPO_ROOT, "docs/BACKEND_DEFAULT_SWITCH_REVIEW.md"), "utf-8")
    expect(doc).toContain("compiler default switch: go")
    expect(doc).toContain("build default switch: go")
    expect(doc).toContain("unified release decision: go")
  })
})
