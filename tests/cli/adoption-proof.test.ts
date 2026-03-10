import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("adoption proof surface", () => {
  test("package and verify surface expose adoption proof gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["adoption:policy"]).toContain("adoption-proof-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run adoption:policy")
  })

  test("adoption proof manifest and policy script stay aligned", async () => {
    const script = await readFile(join(ROOT, "scripts", "adoption-proof-check.mjs"), "utf-8")
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "ADOPTION_PROOF_MANIFEST.json"), "utf-8")) as {
      version: number
      appShapes: Array<{ id: string; proofSurfaceId: string; primaryPath: string; rolloutGuide: string; migrationGuide: string; validates: string[] }>
    }

    expect(script).toContain("proof/proof-catalog.json")
    expect(script).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
    expect(script).toContain("adoption:policy OK")
    expect(manifest.version).toBe(1)
    expect(manifest.appShapes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "frontend-browser-app", proofSurfaceId: "frontend-app", primaryPath: "examples/frontend-app" }),
      expect.objectContaining({ id: "full-saas", proofSurfaceId: "secure-saas", primaryPath: "examples/secure-saas" }),
      expect.objectContaining({ id: "docs-and-content", proofSurfaceId: "content-site", primaryPath: "examples/content-site" }),
      expect.objectContaining({ id: "ops-and-observability", proofSurfaceId: "agent-aware-ops", primaryPath: "examples/agent-aware-ops" }),
      expect.objectContaining({ id: "reference-app", proofSurfaceId: "realworld", primaryPath: "benchmarks/realworld" }),
      expect.objectContaining({ id: "workspace-adoption", proofSurfaceId: "workspace-monorepo", primaryPath: "examples/workspace-monorepo" }),
      expect.objectContaining({ id: "server-api-app", proofSurfaceId: "server-api", primaryPath: "examples/server-api" }),
    ]))
  })

  test("proof, migration, rollout, and support docs expose adoption manifest", async () => {
    const proofDoc = await readFile(join(ROOT, "docs", "MARKET_READY_PROOF.md"), "utf-8")
    const rolloutGuide = await readFile(join(ROOT, "docs", "FIRST_PRODUCTION_ROLLOUT.md"), "utf-8")
    const migrationGuide = await readFile(join(ROOT, "docs", "MIGRATION_GUIDE.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")

    expect(proofDoc).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
    expect(proofDoc).toContain("examples/frontend-app")
    expect(rolloutGuide).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
    expect(migrationGuide).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
    expect(migrationGuide).toContain("examples/workspace-monorepo")
    expect(migrationGuide).toContain("examples/server-api")
    expect(supportMatrix).toContain("adoption:policy")
    expect(supportMatrix).toContain("docs/ADOPTION_PROOF_MANIFEST.json")
    expect(readme).toContain("adoption:policy")
  })
})
