import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("runtime diagnostics policy", () => {
  test("package and verify surface expose runtime diagnostics gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["runtime:policy"]).toContain("runtime-diagnostics-policy-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run runtime:policy")
  })

  test("runtime diagnostics policy script enforces docs and scaffold guidance", async () => {
    const script = await readFile(join(ROOT, "scripts", "runtime-diagnostics-policy-check.mjs"), "utf-8")
    expect(script).toContain("docs/DIAGNOSTICS_CONTRACT.json")
    expect(script).toContain("docs/BUILD_DIAGNOSTICS.md")
    expect(script).toContain("docs/RUNTIME_FAILURES.md")
    expect(script).toContain("docs/CACHE_INVALIDATION.md")
    expect(script).toContain("docs/STREAMING_HYDRATION_FAILURES.md")
    expect(script).toContain("docs/RUNTIME_TRIAGE.md")
    expect(script).toContain("docs/STARTER_FAILURES.md")
    expect(script).toContain("runtime:policy OK")
  })

  test("runtime diagnostics docs and scaffold references are part of shipped surface", async () => {
    const diagnosticsContract = await readFile(join(ROOT, "docs", "DIAGNOSTICS_CONTRACT.json"), "utf-8")
    const buildDiagnostics = await readFile(join(ROOT, "docs", "BUILD_DIAGNOSTICS.md"), "utf-8")
    const runtimeFailures = await readFile(join(ROOT, "docs", "RUNTIME_FAILURES.md"), "utf-8")
    const cacheInvalidation = await readFile(join(ROOT, "docs", "CACHE_INVALIDATION.md"), "utf-8")
    const runtimeTriage = await readFile(join(ROOT, "docs", "RUNTIME_TRIAGE.md"), "utf-8")
    const starterFailures = await readFile(join(ROOT, "docs", "STARTER_FAILURES.md"), "utf-8")
    const frameworkGenerator = await readFile(join(ROOT, "src", "cli", "framework-md.ts"), "utf-8")
    const starterGenerator = await readFile(join(ROOT, "src", "cli", "cmd-create.ts"), "utf-8")

    expect(diagnosticsContract).toContain('"version": 1')
    expect(diagnosticsContract).toContain('"triageOrder"')
    expect(diagnosticsContract).toContain('"incidentSignals"')
    expect(buildDiagnostics).toContain("missing client bundle")
    expect(buildDiagnostics).toContain("`backend`")
    expect(buildDiagnostics).toContain("`phase`")
    expect(buildDiagnostics).toContain("`code`")
    expect(runtimeFailures).toContain("Missing trusted origin for production runtime")
    expect(cacheInvalidation).toContain("`no-store`")
    expect(runtimeTriage).toContain("gorsee ai doctor")
    expect(starterFailures).toContain("security.rpc.middlewares")
    expect(frameworkGenerator).toContain("docs/RUNTIME_FAILURES.md")
    expect(frameworkGenerator).toContain("docs/RUNTIME_TRIAGE.md")
    expect(starterGenerator).toContain("docs/STARTER_FAILURES.md")
  })
})
