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
    expect(script).toContain("must not ignore bun.lock")
    expect(script).toContain("must be tracked in git")
    expect(script).toContain("package.json repository must be")
    expect(script).toContain("package.json homepage must be")
    expect(script).toContain("package.json bugs.url must be")
    expect(script).toContain("must not retain packed tarball artifacts")
    expect(script).toContain("runtime dependency must be pinned exactly")
  })

  test("gitignore excludes packed tarball artifacts without ignoring root bun.lock", async () => {
    const gitignore = await readFile(join(REPO_ROOT, ".gitignore"), "utf-8")
    expect(gitignore).toContain("*.tgz")
    expect(gitignore.split(/\r?\n/)).not.toContain("bun.lock")
  })
})
