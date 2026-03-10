import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("top-tier exit gate", () => {
  test("package and verify surface expose the top-tier exit gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["top-tier:exit"]).toContain("top-tier-exit-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run top-tier:exit")
  })

  test("exit gate policy script enforces the governance closure surface", async () => {
    const script = await readFile(join(ROOT, "scripts", "top-tier-exit-check.mjs"), "utf-8")
    expect(script).toContain("docs/TOP_TIER_EXIT_GATE.md")
    expect(script).toContain("docs/TOP_TIER_ROADMAP.md")
    expect(script).toContain("docs/MATURITY_POLICY.md")
    expect(script).toContain("docs/RELEASE_POLICY.md")
    expect(script).toContain("top-tier:exit OK")
  })

  test("roadmap, maturity docs, and release docs expose baseline closure explicitly", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const roadmap = await readFile(join(ROOT, "docs", "TOP_TIER_ROADMAP.md"), "utf-8")
    const exitGate = await readFile(join(ROOT, "docs", "TOP_TIER_EXIT_GATE.md"), "utf-8")
    const maturity = await readFile(join(ROOT, "docs", "MATURITY_POLICY.md"), "utf-8")
    const completion = await readFile(join(ROOT, "docs", "ROADMAP_COMPLETION_POLICY.md"), "utf-8")
    const releasePolicy = await readFile(join(ROOT, "docs", "RELEASE_POLICY.md"), "utf-8")
    const releaseChecklist = await readFile(join(ROOT, "docs", "RELEASE_CHECKLIST.md"), "utf-8")

    expect(readme).toContain("Top-Tier Exit Gate")
    expect(roadmap).toContain("Roadmap Closure")
    expect(roadmap).toContain("baseline top-tier maturity plan is complete")
    expect(exitGate).toContain("What Changes After Exit")
    expect(exitGate).toContain("Reopen Rule")
    expect(maturity).toContain("docs/TOP_TIER_EXIT_GATE.md")
    expect(completion).toContain("docs/TOP_TIER_EXIT_GATE.md")
    expect(releasePolicy).toContain("docs/TOP_TIER_EXIT_GATE.md")
    expect(releaseChecklist).toContain("docs/TOP_TIER_EXIT_GATE.md")
  })
})
