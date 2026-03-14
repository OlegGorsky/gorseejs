import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

const ROOT = resolve(import.meta.dir, "../..")

describe("external proof scaffold", () => {
  test("package exposes the scaffold script", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["external-proof:scaffold"]).toBe("node scripts/external-proof-scaffold.mjs")
  })

  test("scaffold creates a local draft bundle with claim catalog", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gorsee-external-proof-"))

    try {
      const result = spawnSync(process.execPath, [
        join(ROOT, "scripts", "external-proof-scaffold.mjs"),
        "--cwd",
        cwd,
        "--type",
        "migration",
        "--id",
        "public-migration-alpha",
        "--json",
      ], {
        cwd: ROOT,
        encoding: "utf-8",
      })

      expect(result.status).toBe(0)
      const output = JSON.parse(result.stdout) as {
        markdownPath: string
        metaPath: string
        claimIds: string[]
        proofHints: Array<{ id: string; path: string; validates: string[] }>
      }

      const draft = await readFile(output.markdownPath, "utf-8")
      const meta = JSON.parse(await readFile(output.metaPath, "utf-8")) as {
        id: string
        type: string
        claimsCatalog: string
        proofCatalog: string
        adoptionManifest: string
        proofHints: Array<{ id: string; path: string; validates: string[] }>
      }

      expect(draft).toContain("external-proof draft id: public-migration-alpha")
      expect(draft).toContain("## Repo-Local Proof Hints")
      expect(draft).toContain("secure-saas: examples/secure-saas")
      expect(draft).toContain("## Claim Catalog")
      expect(draft).toContain("- typed-routes")
      expect(meta).toEqual(expect.objectContaining({
        id: "public-migration-alpha",
        type: "migration",
        claimsCatalog: "docs/EXTERNAL_PROOF_CLAIMS.json",
        proofCatalog: "proof/proof-catalog.json",
        adoptionManifest: "docs/ADOPTION_PROOF_MANIFEST.json",
      }))
      expect(meta.proofHints).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "secure-saas", path: "examples/secure-saas" }),
        expect.objectContaining({ id: "workspace-monorepo", path: "examples/workspace-monorepo" }),
      ]))
      expect(output.claimIds).toContain("migration-ergonomics")
      expect(output.proofHints).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "secure-saas", path: "examples/secure-saas" }),
      ]))
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
