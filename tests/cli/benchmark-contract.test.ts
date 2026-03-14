import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("benchmark contract surface", () => {
  test("benchmark contract manifest and policy script stay aligned", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "BENCHMARK_CONTRACT.json"), "utf-8")) as {
      version: number
      schemaPath: string
      benchmarkFamilies: Array<{
        id: string
        packageName: string
        path: string
        kinds: string[]
        requiredScripts: string[]
        readmeTokens: string[]
        artifactPath?: string
        baselinePath?: string
        requiredScenarioCategories?: string[]
      }>
      requiredDocs: string[]
      requiredReactiveTokens: string[]
      realworldArtifactContract: {
        benchmark: string
        kind: string
        requiredFields: string[]
      }
    }
    const script = await readFile(join(ROOT, "scripts", "benchmark-policy-check.mjs"), "utf-8")

    expect(manifest.version).toBe(1)
    expect(manifest.schemaPath).toBe("benchmarks/benchmark-artifact.schema.json")
    expect(manifest.requiredDocs).toEqual(expect.arrayContaining([
      "docs/BENCHMARK_POLICY.md",
      "docs/BENCHMARK_METHODOLOGY.md",
      "docs/BENCHMARK_ARTIFACTS.md",
      "docs/BENCHMARK_RELEASE_DISCIPLINE.md",
      "docs/REACTIVE_BENCHMARKS.md",
      "docs/BENCHMARK_CONTRACT.json",
    ]))
    expect(manifest.benchmarkFamilies).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "ssr-throughput", packageName: "gorsee-bench-ssr", path: "benchmarks/ssr-throughput" }),
      expect.objectContaining({ id: "js-framework-bench", packageName: "gorsee-bench-dom", path: "benchmarks/js-framework-bench" }),
      expect.objectContaining({
        id: "realworld",
        packageName: "gorsee-realworld",
        path: "benchmarks/realworld",
        artifactPath: "benchmarks/realworld/artifact.json",
        baselinePath: "benchmarks/realworld/baseline.json",
      }),
    ]))
    expect(manifest.realworldArtifactContract).toEqual(expect.objectContaining({
      benchmark: "realworld",
      kind: "fullstack-shape",
      requiredFields: ["benchmark", "kind", "ts", "environment", "metrics"],
    }))
    expect(
      manifest.benchmarkFamilies.find((family) => family.id === "realworld")?.requiredScenarioCategories,
    ).toEqual(expect.arrayContaining([
      "hydrationGrowthMs",
      "multiIslandRouteGrowthMs",
      "resourceInvalidationPressureMs",
      "rollbackHeavyMutationsMs",
    ]))
    expect(manifest.requiredReactiveTokens).toEqual(expect.arrayContaining([
      "Current Gaps",
      "baseline.json",
      "regression gate",
    ]))
    expect(script).toContain("docs/BENCHMARK_CONTRACT.json")
    expect(script).toContain("benchmarkFamilies")
    expect(script).toContain("benchmarks:policy OK")
  })

  test("README, support matrix, and release contract expose benchmark contract", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")
    const ciPolicy = await readFile(join(ROOT, "docs", "CI_POLICY.md"), "utf-8")
    const releaseContract = await readFile(join(ROOT, "docs", "RELEASE_CONTRACT.json"), "utf-8")

    expect(readme).toContain("Benchmark Contract")
    expect(readme).toContain("benchmarks:policy")
    expect(supportMatrix).toContain("docs/BENCHMARK_CONTRACT.json")
    expect(supportMatrix).toContain("benchmarks:realworld:check")
    expect(ciPolicy).toContain("Benchmark Evidence Surface")
    expect(ciPolicy).toContain("docs/BENCHMARK_CONTRACT.json")
    expect(releaseContract).toContain("docs/BENCHMARK_CONTRACT.json")
  })
})
