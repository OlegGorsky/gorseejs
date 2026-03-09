import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("repo policy", () => {
  test("package manifest declares exact Bun packageManager", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      packageManager?: string
    }

    expect(pkg.packageManager).toBe("bun@1.3.9")
  })

  test("repo policy script enforces lockfile and packageManager contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/repo-policy-check.mjs"), "utf-8")
    expect(script).toContain("packageManager")
    expect(script).toContain("bun.lock")
    expect(script).toContain("must not declare repository")
    expect(script).toContain("must not declare homepage")
    expect(script).toContain("runtime dependency must be pinned exactly")
  })
})
