import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("release channel policy", () => {
  test("package version currently matches stable release policy", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      version: string
    }
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test("release channel check script defines stable/canary/rc rules", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/release-channel-check.mjs"), "utf-8")
    expect(script).toContain("stable")
    expect(script).toContain("canary")
    expect(script).toContain("rc")
    expect(script).toContain("npm tag")
  })

  test("release version planner script defines stable/canary/rc version transitions", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/release-version-plan.mjs"), "utf-8")
    expect(script).toContain("stable")
    expect(script).toContain("canary")
    expect(script).toContain("rc")
    expect(script).toContain("planReleaseVersion")
  })
})
