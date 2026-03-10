import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("coverage audit surface", () => {
  test("package and verify surface expose coverage audit gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["coverage:audit"]).toContain("coverage-audit-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run coverage:audit")
  })

  test("coverage audit policy script enforces the documented surface", async () => {
    const script = await readFile(join(ROOT, "scripts", "coverage-audit-check.mjs"), "utf-8")
    expect(script).toContain("docs/TEST_COVERAGE_AUDIT.md")
    expect(script).toContain("docs/CI_POLICY.md")
    expect(script).toContain("docs/SUPPORT_MATRIX.md")
    expect(script).toContain("coverage:audit OK")
  })

  test("coverage audit doc tracks core gap identifiers and enforcement hooks", async () => {
    const auditDoc = await readFile(join(ROOT, "docs", "TEST_COVERAGE_AUDIT.md"), "utf-8")
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const ciPolicy = await readFile(join(ROOT, "docs", "CI_POLICY.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")

    expect(auditDoc).toContain("COV-RUNTIME-001")
    expect(auditDoc).toContain("COV-SECURITY-001")
    expect(auditDoc).toContain("COV-PUBLISH-001")
    expect(auditDoc).toContain("COV-GATE-001")
    expect(auditDoc).toContain("`bun run coverage:audit`")
    expect(auditDoc).toContain("`bun run critical:surface`")
    expect(auditDoc).toContain("`bun run test:critical-surface`")
    expect(readme).toContain("Test Coverage Audit")
    expect(ciPolicy).toContain("Coverage Audit Surface")
    expect(supportMatrix).toContain("test coverage audit")
  })
})
