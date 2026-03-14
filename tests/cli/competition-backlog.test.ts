import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("competition backlog surface", () => {
  test("package and verify surface expose competition backlog gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["competition:policy"]).toContain("competition-backlog-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run competition:policy")
  })

  test("competition backlog docs and policy script stay aligned", async () => {
    const script = await readFile(join(ROOT, "scripts", "competition-backlog-check.mjs"), "utf-8")
    const backlog = JSON.parse(await readFile(join(ROOT, "docs", "COMPETITION_BACKLOG.json"), "utf-8")) as {
      version: number
      remainingExternalGaps: Array<{ id: string; status: string; deliverables: string[] }>
    }
    const closurePlan = await readFile(join(ROOT, "docs", "COMPETITION_CLOSURE_PLAN.md"), "utf-8")
    const audit = await readFile(join(ROOT, "docs", "PRODUCT_SURFACE_AUDIT.md"), "utf-8")
    const intake = await readFile(join(ROOT, "docs", "EXTERNAL_PROOF_INTAKE.md"), "utf-8")
    const review = await readFile(join(ROOT, "docs", "EXTERNAL_PROOF_REVIEW.md"), "utf-8")
    const pipeline = JSON.parse(await readFile(join(ROOT, "docs", "EXTERNAL_PROOF_PIPELINE.json"), "utf-8")) as {
      version: number
      pendingSchemas: Record<string, string[]>
      pendingMigrationCaseStudies: unknown[]
      pendingExternalReferences: unknown[]
    }
    const registry = JSON.parse(await readFile(join(ROOT, "docs", "EXTERNAL_PROOF_REGISTRY.json"), "utf-8")) as {
      version: number
      acceptedSchemas: Record<string, string[]>
      migrationCaseStudies: unknown[]
      externalReferences: unknown[]
    }

    expect(script).toContain("docs/COMPETITION_BACKLOG.json")
    expect(script).toContain("docs/COMPETITION_CLOSURE_PLAN.md")
    expect(script).toContain("docs/EXTERNAL_PROOF_INTAKE.md")
    expect(script).toContain("docs/EXTERNAL_PROOF_PIPELINE.json")
    expect(script).toContain("docs/EXTERNAL_PROOF_REVIEW.md")
    expect(script).toContain("docs/EXTERNAL_PROOF_REGISTRY.json")
    expect(script).toContain("competition:policy OK")
    expect(backlog.version).toBe(1)
    expect(pipeline.version).toBe(1)
    expect(registry.version).toBe(1)
    expect(pipeline.pendingSchemas.migrationCaseStudy).toContain("reviewStatus")
    expect(registry.acceptedSchemas.migrationCaseStudy).toContain("acceptedAt")
    expect(pipeline.pendingMigrationCaseStudies).toEqual([])
    expect(pipeline.pendingExternalReferences).toEqual([])
    expect(registry.migrationCaseStudies).toEqual([])
    expect(registry.externalReferences).toEqual([])
    expect(backlog.remainingExternalGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "external-proof", status: "open" }),
      expect.objectContaining({ id: "adoption-funnel", status: "open" }),
      expect.objectContaining({ id: "comparative-reactive-evidence", status: "open" }),
      expect.objectContaining({ id: "editor-ecosystem-reach", status: "open" }),
    ]))
    expect(closurePlan).toContain("Machine-readable companion: `docs/COMPETITION_BACKLOG.json`")
    expect(intake).toContain("docs/EXTERNAL_PROOF_PIPELINE.json")
    expect(intake).toContain("docs/EXTERNAL_PROOF_REVIEW.md")
    expect(review).toContain("pending")
    expect(review).toContain("accepted")
    expect(intake).toContain("docs/templates/EXTERNAL_MIGRATION_CASE_STUDY.md")
    expect(audit).toContain("docs/COMPETITION_CLOSURE_PLAN.md")
    expect(audit).toContain("docs/COMPETITION_BACKLOG.json")
    expect(audit).toContain("docs/EXTERNAL_PROOF_PIPELINE.json")
    expect(audit).toContain("docs/EXTERNAL_PROOF_REVIEW.md")
    expect(audit).toContain("docs/EXTERNAL_PROOF_REGISTRY.json")
  })
})
