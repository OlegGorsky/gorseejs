import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("ai policy", () => {
  test("package and verify surface expose ai policy gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["ai:policy"]).toContain("ai-policy-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run ai:policy")
  })

  test("ai policy script enforces workflow docs and agent contract", async () => {
    const script = await readFile(join(ROOT, "scripts", "ai-policy-check.mjs"), "utf-8")
    expect(script).toContain("docs/AI_WORKFLOWS.md")
    expect(script).toContain("docs/AI_IDE_SYNC_WORKFLOW.md")
    expect(script).toContain("docs/AI_MCP_WORKFLOW.md")
    expect(script).toContain("docs/AI_BRIDGE_WORKFLOW.md")
    expect(script).toContain("docs/AI_TOOL_BUILDERS.md")
    expect(script).toContain("docs/AI_SURFACE_STABILITY.md")
    expect(script).toContain("docs/AI_SESSION_PACKS.md")
    expect(script).toContain("docs/AI_DEBUGGING_WORKFLOWS.md")
    expect(script).toContain("ai:policy OK")
  })

  test("ai workflow docs and AGENTS guidance are part of shipped surface", async () => {
    const workflows = await readFile(join(ROOT, "docs", "AI_WORKFLOWS.md"), "utf-8")
    const stability = await readFile(join(ROOT, "docs", "AI_SURFACE_STABILITY.md"), "utf-8")
    const sessionPacks = await readFile(join(ROOT, "docs", "AI_SESSION_PACKS.md"), "utf-8")
    const debugging = await readFile(join(ROOT, "docs", "AI_DEBUGGING_WORKFLOWS.md"), "utf-8")
    const agents = await readFile(join(ROOT, "AGENTS.md"), "utf-8")

    expect(workflows).toContain("human + agent collaboration")
    expect(stability).toContain("Stable Surfaces")
    expect(sessionPacks).toContain(".gorsee/agent/latest.json")
    expect(sessionPacks).toContain(".gorsee/agent/deploy-summary.json")
    expect(sessionPacks).toContain(".gorsee/agent/release-brief.json")
    expect(sessionPacks).toContain(".gorsee/agent/incident-brief.json")
    expect(sessionPacks).toContain(".gorsee/agent/incident-snapshot.json")
    expect(debugging).toContain("gorsee ai doctor")
    expect(agents).toContain("docs/AI_WORKFLOWS.md")
    expect(agents).toContain("docs/AI_SURFACE_STABILITY.md")
  })
})
