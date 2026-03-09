import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("compiler platform planning surface", () => {
  test("package scripts expose compiler audit", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.["compiler:audit"]).toBe("node scripts/compiler-platform-audit.mjs")
    expect(pkg.scripts?.["compiler:parity"]).toBe("node scripts/compiler-backend-parity.mjs")
    expect(pkg.scripts?.["compiler:promotion:check"]).toBe("node scripts/compiler-promotion-check.mjs")
    expect(pkg.scripts?.["compiler:dossier:check"]).toBe("node scripts/compiler-dossier-check.mjs")
    expect(pkg.scripts?.["compiler:default:rehearsal:check"]).toBe("node scripts/compiler-default-switch-rehearsal-check.mjs")
    expect(pkg.scripts?.["build:parity"]).toBe("bun scripts/build-backend-parity.mjs")
    expect(pkg.scripts?.["build:promotion:check"]).toBe("node scripts/build-promotion-check.mjs")
    expect(pkg.scripts?.["build:dossier:check"]).toBe("node scripts/build-dossier-check.mjs")
    expect(pkg.scripts?.["build:canary"]).toBe(
      "bun scripts/build-backend-parity.mjs && bun test tests/cli/programmatic-runtime.test.ts tests/build/init.test.ts tests/integration/production-backend-parity.test.ts",
    )
    expect(pkg.scripts?.["build:evidence:verify"]).toContain("tests/build/rolldown-runtime-contract.test.ts")
    expect(pkg.scripts?.["build:evidence:verify"]).toContain("bun run test:browser-smoke")
  })

  test("top-tier roadmap includes compiler platform closure strategy", async () => {
    const roadmap = await readFile(join(REPO_ROOT, "docs/TOP_TIER_ROADMAP.md"), "utf-8")
    expect(roadmap).toContain("Stage 4: Compiler Platform Closure")
    expect(roadmap).toContain("version generated artifacts and define explicit schemas")
    expect(roadmap).toContain("canonical compiler/build interfaces")
    expect(roadmap).toContain("preserve the current `oxc` and `rolldown` defaults")
    expect(roadmap).toContain("docs, typegen, and build metadata now derive from the same canonical route-facts contract")
  })

  test("compiler audit script inventories Bun, TypeScript, and transform touchpoints", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts/compiler-platform-audit.mjs"), "utf-8")
    expect(script).toContain("buildBackend")
    expect(script).toContain("compilerAnalysis")
    expect(script).toContain("typescriptAst")
    expect(script).toContain("bunBuild")
  })
})
