import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("maturity policy", () => {
  test("package and verify surface expose maturity policy gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["maturity:policy"]).toContain("maturity-policy-check.mjs")
    expect(pkg.scripts["dependency:policy"]).toContain("dependency-contract-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run dependency:policy")
    expect(pkg.scripts["verify:security"]).toContain("bun run maturity:policy")
  })

  test("maturity policy script enforces governance docs", async () => {
    const script = await readFile(join(ROOT, "scripts", "maturity-policy-check.mjs"), "utf-8")
    expect(script).toContain("docs/MATURITY_POLICY.md")
    expect(script).toContain("docs/DEPENDENCY_POLICY.md")
    expect(script).toContain("docs/COMPATIBILITY_GUARDRAILS.md")
    expect(script).toContain("docs/AMBIGUITY_POLICY.md")
    expect(script).toContain("docs/DX_FEEDBACK_LOOP.md")
    expect(script).toContain("docs/EVIDENCE_POLICY.md")
    expect(script).toContain("docs/ROADMAP_COMPLETION_POLICY.md")
    expect(script).toContain("maturity:policy OK")
  })

  test("maturity docs are part of shipped governance surface", async () => {
    const maturity = await readFile(join(ROOT, "docs", "MATURITY_POLICY.md"), "utf-8")
    const dependency = await readFile(join(ROOT, "docs", "DEPENDENCY_POLICY.md"), "utf-8")
    const contract = await readFile(join(ROOT, "docs", "DEPENDENCY_CONTRACT.json"), "utf-8")
    const compatibility = await readFile(join(ROOT, "docs", "COMPATIBILITY_GUARDRAILS.md"), "utf-8")
    const ambiguity = await readFile(join(ROOT, "docs", "AMBIGUITY_POLICY.md"), "utf-8")
    const evidence = await readFile(join(ROOT, "docs", "EVIDENCE_POLICY.md"), "utf-8")
    const completion = await readFile(join(ROOT, "docs", "ROADMAP_COMPLETION_POLICY.md"), "utf-8")

    expect(maturity).toContain("Core Rules")
    expect(dependency).toContain("prefer no new dependency")
    expect(dependency).toContain("docs/DEPENDENCY_CONTRACT.json")
    expect(contract).toContain('"packageManager": "bun@1.3.9"')
    expect(compatibility).toContain("root `gorsee`")
    expect(ambiguity).toContain("Ambiguity Signals")
    expect(evidence).toContain("Evidence Sources")
    expect(completion).toContain("Completion Rule")
  })
})
