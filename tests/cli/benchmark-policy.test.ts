import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("benchmark policy", () => {
  test("package and verify surface expose benchmark policy gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["benchmarks:policy"]).toContain("benchmark-policy-check.mjs")
    expect(pkg.scripts["benchmarks:realworld:check"]).toContain("realworld-benchmark-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run benchmarks:policy")
    expect(pkg.scripts["verify:security"]).toContain("bun run benchmarks:realworld:check")
  })

  test("benchmark policy script enforces benchmark contract and docs", async () => {
    const script = await readFile(join(ROOT, "scripts", "benchmark-policy-check.mjs"), "utf-8")
    expect(script).toContain("docs/BENCHMARK_CONTRACT.json")
    expect(script).toContain("manifest.requiredDocs")
    expect(script).toContain("benchmarkFamilies")
    expect(script).toContain("validateArtifact")
    expect(script).toContain("validateBaseline")
    expect(script).toContain("generated/install artifact")
    expect(script).toContain(".gorsee")
    expect(script).toContain("node_modules")
    expect(script).toContain("benchmarks:policy OK")
  })

  test("reactive and benchmark docs are part of product surface", async () => {
    const patterns = await readFile(join(ROOT, "docs", "REACTIVE_PATTERNS.md"), "utf-8")
    const policy = await readFile(join(ROOT, "docs", "BENCHMARK_POLICY.md"), "utf-8")
    const contract = await readFile(join(ROOT, "docs", "BENCHMARK_CONTRACT.json"), "utf-8")
    const methodology = await readFile(join(ROOT, "docs", "BENCHMARK_METHODOLOGY.md"), "utf-8")
    const releaseDiscipline = await readFile(join(ROOT, "docs", "BENCHMARK_RELEASE_DISCIPLINE.md"), "utf-8")
    expect(patterns).toContain("createResource")
    expect(patterns).toContain("createMutation")
    expect(patterns).toContain("Suspense")
    expect(patterns).toContain("island()")
    expect(policy).toContain("Benchmark Policy")
    expect(policy).toContain("evidence, not decoration")
    expect(policy).toContain("benchmarks/realworld")
    expect(policy).toContain("docs/BENCHMARK_CONTRACT.json")
    expect(contract).toContain("\"benchmarkFamilies\"")
    expect(contract).toContain("\"realworldArtifactContract\"")
    expect(policy).toContain("clean, reproducible repository surface")
    expect(methodology).toContain("Methodology Rules")
    expect(methodology).toContain("docs/BENCHMARK_CONTRACT.json")
    expect(releaseDiscipline).toContain("Public Claim Threshold")
    expect(releaseDiscipline).toContain("machine-readable `benchmarks/realworld` artifact")
    expect(releaseDiscipline).toContain("docs/BENCHMARK_CONTRACT.json")
    expect(await readFile(join(ROOT, "docs", "REACTIVE_BENCHMARKS.md"), "utf-8")).toContain("regression gate")
  })
})
