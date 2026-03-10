import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("proof surface contracts", () => {
  test("proof catalog covers canonical market-ready surfaces", async () => {
    const catalog = JSON.parse(await readFile(join(REPO_ROOT, "proof/proof-catalog.json"), "utf-8")) as {
      schemaVersion: number
      surfaces: Array<{ id: string; proofClass: string; path: string; validates: string[] }>
    }

    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "frontend-app", proofClass: "frontend-adoption" }),
      expect.objectContaining({ id: "secure-saas", proofClass: "full-saas" }),
      expect.objectContaining({ id: "content-site", proofClass: "docs-and-content" }),
      expect.objectContaining({ id: "agent-aware-ops", proofClass: "ops-and-observability" }),
      expect.objectContaining({ id: "realworld", proofClass: "reference-app" }),
      expect.objectContaining({ id: "workspace-monorepo", proofClass: "workspace-adoption" }),
      expect.objectContaining({ id: "server-api", proofClass: "server-adoption" }),
    ]))
    for (const surface of catalog.surfaces) {
      expect(surface.validates.length).toBeGreaterThan(0)
      expect(surface.path.length).toBeGreaterThan(0)
    }
  })

  test("proof policy script and docs stay aligned", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/proof-surface-check.mjs"), "utf-8")
    const proofDoc = await readFile(join(REPO_ROOT, "docs/MARKET_READY_PROOF.md"), "utf-8")
    const migrationGuide = await readFile(join(REPO_ROOT, "docs/MIGRATION_GUIDE.md"), "utf-8")
    const rolloutGuide = await readFile(join(REPO_ROOT, "docs/FIRST_PRODUCTION_ROLLOUT.md"), "utf-8")

    expect(script).toContain("proof/proof-catalog.json")
    expect(script).toContain("benchmarks/realworld")
    expect(script).toContain("proof:surface:check OK")
    expect(proofDoc).toContain("Market-Ready Proof")
    expect(proofDoc).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
    expect(proofDoc).toContain("examples/frontend-app")
    expect(proofDoc).toContain("examples/secure-saas")
    expect(proofDoc).toContain("benchmarks/realworld")
    expect(proofDoc).toContain("examples/server-api")
    expect(rolloutGuide).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
    expect(migrationGuide).toContain("Next.js")
    expect(migrationGuide).toContain("Remix")
    expect(migrationGuide).toContain("Astro")
    expect(migrationGuide).toContain("Nuxt")
    expect(migrationGuide).toContain("gorsee upgrade")
    expect(migrationGuide).toContain("examples/workspace-monorepo")
    expect(migrationGuide).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
  })
})
