import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("critical surface suite", () => {
  test("package and verify surface expose critical surface gates", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["critical:surface"]).toContain("critical-surface-check.mjs")
    expect(pkg.scripts["test:critical-surface"]).toContain("tests/server/compress.test.ts")
    expect(pkg.scripts["test:critical-surface"]).toContain("tests/runtime/router-navigation.test.ts")
    expect(pkg.scripts["test:critical-surface"]).toContain("tests/ai/mcp.test.ts")
    expect(pkg.scripts["verify:security"]).toContain("bun run critical:surface")
    expect(pkg.scripts["verify:security"]).toContain("bun run test:critical-surface")
  })

  test("critical surface policy script enforces workflow and docs alignment", async () => {
    const script = await readFile(join(ROOT, "scripts", "critical-surface-check.mjs"), "utf-8")
    expect(script).toContain(".github/workflows/ci.yml")
    expect(script).toContain("docs/CI_POLICY.md")
    expect(script).toContain("docs/SUPPORT_MATRIX.md")
    expect(script).toContain("docs/TEST_COVERAGE_AUDIT.md")
    expect(script).toContain("critical:surface OK")
  })

  test("docs and CI expose the critical surface suite as a mandatory gate", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const ciPolicy = await readFile(join(ROOT, "docs", "CI_POLICY.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")
    const auditDoc = await readFile(join(ROOT, "docs", "TEST_COVERAGE_AUDIT.md"), "utf-8")
    const workflow = await readFile(join(ROOT, ".github", "workflows", "ci.yml"), "utf-8")

    expect(readme).toContain("Critical Surface Suite")
    expect(readme).toContain("critical:surface")
    expect(readme).toContain("test:critical-surface")
    expect(ciPolicy).toContain("Critical Surface Suite")
    expect(ciPolicy).toContain("bun run critical:surface")
    expect(ciPolicy).toContain("bun run test:critical-surface")
    expect(supportMatrix).toContain("critical surface suite")
    expect(supportMatrix).toContain("test:critical-surface")
    expect(auditDoc).toContain("COV-GATE-001")
    expect(auditDoc).toContain("router navigation regressions")
    expect(auditDoc).toContain("MCP default limit")
    expect(workflow).toContain("bun run critical:surface")
    expect(workflow).toContain("bun run test:critical-surface")
  })
})
