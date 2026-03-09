import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("compiler execution backlog", () => {
  test("backlog documents audit totals and migration waves", async () => {
    const backlog = await readFile(join(REPO_ROOT, "docs/COMPILER_EXECUTION_BACKLOG.md"), "utf-8")

    expect(backlog).toContain("23 compiler/build/release files")
    expect(backlog).toContain("42 regex/string transform touchpoints")
    expect(backlog).toContain("Wave 1: OXC Analysis Backbone")
    expect(backlog).toContain("Wave 4: Rolldown Backend Spike")
    expect(backlog).toContain("Do not start with the bundler swap")
  })
})
