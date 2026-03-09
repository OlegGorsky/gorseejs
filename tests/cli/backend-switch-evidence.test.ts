import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("backend switch evidence", () => {
  test("package scripts expose backend switch evidence check", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["backend:switch:evidence:check"]).toBe("node scripts/backend-switch-evidence-check.mjs")
    expect(pkg.scripts?.["compiler:dossier:check"]).toBe("node scripts/compiler-dossier-check.mjs")
expect(pkg.scripts?.["build:dossier:check"]).toBe("node scripts/build-dossier-check.mjs")
  })

  test("backend switch evidence script validates go/no-go contract", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/backend-switch-evidence-check.mjs"), "utf-8")
    expect(script).toContain("missing backend switch evidence script")
    expect(script).toContain("Backend switch evidence doc missing token")
    expect(script).toContain("COMPILER_DEFAULT_SWITCH_DOSSIER")
    expect(script).toContain("BUILD_DEFAULT_SWITCH_DOSSIER")
    expect(script).toContain("backend:switch:evidence OK")
  })

  test("compiler/build switch dossiers expose explicit decision state", async () => {
    const compilerDossier = await readFile(join(REPO_ROOT, "docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")
    const buildDossier = await readFile(join(REPO_ROOT, "docs/BUILD_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")

    expect(compilerDossier).toContain("Current default:")
    expect(compilerDossier).toContain("Previous default:")
    expect(compilerDossier).toContain("current decision: go for default switch")

    expect(buildDossier).toContain("Current default:")
    expect(buildDossier).toContain("Previous default:")
    expect(buildDossier).toContain("current decision: go for default switch")
  })
})
