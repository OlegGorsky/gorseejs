#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const manifest = JSON.parse(readFileSync(join(repoRoot, "docs/BENCHMARK_CONTRACT.json"), "utf-8"))
const benchmarkPolicy = readFileSync(join(repoRoot, "docs/BENCHMARK_POLICY.md"), "utf-8")
const reactiveBenchmarks = readFileSync(join(repoRoot, "docs/REACTIVE_BENCHMARKS.md"), "utf-8")
const methodologyDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_METHODOLOGY.md"), "utf-8")
const ssrProofDoc = readFileSync(join(repoRoot, "docs/SSR_BENCHMARK_PROOF.md"), "utf-8")
const domProofDoc = readFileSync(join(repoRoot, "docs/DOM_BENCHMARK_PROOF.md"), "utf-8")
const artifactsDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_ARTIFACTS.md"), "utf-8")
const releaseDisciplineDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_RELEASE_DISCIPLINE.md"), "utf-8")
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const artifactSchema = JSON.parse(readFileSync(join(repoRoot, manifest.schemaPath), "utf-8"))

if (!packageJson.scripts?.["benchmarks:policy"]?.includes("benchmark-policy-check.mjs")) {
  throw new Error("missing benchmarks:policy script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run benchmarks:policy")) {
  throw new Error("verify:security must run benchmarks:policy")
}

if (manifest.version !== 1) {
  throw new Error(`BENCHMARK_CONTRACT version must be 1, received ${String(manifest.version)}`)
}

for (const file of manifest.requiredDocs ?? []) {
  statSync(join(repoRoot, file))
}

for (const token of manifest.requiredPolicyTokens ?? []) {
  assertIncludes(benchmarkPolicy, token, `benchmark policy missing token: ${token}`)
}

for (const token of manifest.requiredMethodologyTokens ?? []) {
  assertIncludes(methodologyDoc, token, `benchmark methodology missing token: ${token}`)
}

for (const token of manifest.requiredArtifactTokens ?? []) {
  assertIncludes(artifactsDoc, token, `benchmark artifacts doc missing token: ${token}`)
}

for (const token of manifest.requiredReleaseTokens ?? []) {
  assertIncludes(releaseDisciplineDoc, token, `benchmark release discipline doc missing token: ${token}`)
}

for (const token of manifest.requiredReactiveTokens ?? []) {
  assertIncludes(reactiveBenchmarks, token, `reactive benchmarks doc missing token: ${token}`)
}

for (const [label, source, tokens] of [
  ["ssr proof", ssrProofDoc, ["mature product", "What It Proves", "What It Does Not Prove", "`benchmarks/ssr-throughput`"]],
  ["dom proof", domProofDoc, ["mature product", "What It Proves", "What It Does Not Prove", "`benchmarks/js-framework-bench`"]],
  ["support matrix", supportMatrix, ["docs/BENCHMARK_CONTRACT.json", "benchmarks:policy"]],
  ["README", readme, ["Benchmark Contract", "docs/BENCHMARK_CONTRACT.json", "benchmarks:policy"]],
]) {
  for (const token of tokens) {
    assertIncludes(source, token, `${label} missing token: ${token}`)
  }
}

for (const field of manifest.realworldArtifactContract.requiredFields ?? []) {
  if (!artifactSchema.required?.includes(field)) {
    throw new Error(`benchmark artifact schema missing required field: ${field}`)
  }
}

for (const family of manifest.benchmarkFamilies ?? []) {
  const benchmarkDir = join(repoRoot, family.path)
  statSync(benchmarkDir)
  const benchmarkPkg = JSON.parse(readFileSync(join(benchmarkDir, "package.json"), "utf-8"))
  const benchmarkReadme = readFileSync(join(benchmarkDir, "README.md"), "utf-8")

  if (benchmarkPkg.name !== family.packageName) {
    throw new Error(`benchmark package name drift for ${family.path}: expected ${family.packageName}, received ${benchmarkPkg.name ?? "missing"}`)
  }

  for (const scriptName of family.requiredScripts ?? []) {
    expectScript(benchmarkPkg, scriptName)
  }

  for (const token of family.readmeTokens ?? []) {
    assertIncludes(benchmarkReadme, token, `${family.id} README missing token: ${token}`)
  }

  assertNoForbiddenArtifacts(benchmarkDir, `benchmark ${relative(repoRoot, benchmarkDir)}`)

  for (const kind of family.kinds ?? []) {
    if (!artifactSchema.properties?.kind?.enum?.includes(kind)) {
      throw new Error(`benchmark artifact schema missing supported kind: ${kind}`)
    }
  }

  if (family.artifactPath) {
    const artifact = JSON.parse(readFileSync(join(repoRoot, family.artifactPath), "utf-8"))
    validateArtifact(artifact, family, manifest.realworldArtifactContract)
  }

  if (family.baselinePath) {
    const baseline = JSON.parse(readFileSync(join(repoRoot, family.baselinePath), "utf-8"))
    validateBaseline(baseline, family)
  }
}

console.log("benchmarks:policy OK")

function expectScript(pkg, scriptName) {
  if (!pkg.scripts?.[scriptName]) {
    throw new Error(`benchmark package ${pkg.name} missing script: ${scriptName}`)
  }
}

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}

function assertNoForbiddenArtifacts(rootDir, label) {
  const forbiddenNames = new Set(["node_modules", "dist", ".gorsee"])
  const forbiddenPrefixes = [".gorsee-", ".old-"]
  const forbiddenSuffixes = [".db", ".sqlite"]

  for (const entry of walkEntries(rootDir)) {
    const name = entry.split("/").pop() ?? entry
    if (
      forbiddenNames.has(name) ||
      forbiddenPrefixes.some((prefix) => name.startsWith(prefix)) ||
      forbiddenSuffixes.some((suffix) => name.endsWith(suffix))
    ) {
      throw new Error(`${label} must not ship generated/install artifact: ${relative(repoRoot, entry)}`)
    }
  }
}

function* walkEntries(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    yield fullPath
    if (entry.isDirectory()) {
      yield* walkEntries(fullPath)
    }
  }
}

function validateArtifact(artifact, family, contract) {
  if (artifact.benchmark !== contract.benchmark || artifact.kind !== contract.kind) {
    throw new Error(`${family.id} benchmark artifact must stay aligned with the canonical realistic benchmark contract`)
  }

  if (typeof artifact.notes !== "string") {
    throw new Error(`${family.id} benchmark artifact must contain notes`)
  }

  for (const forbidden of contract.notesMustNotContain ?? []) {
    if (artifact.notes.includes(forbidden)) {
      throw new Error(`${family.id} benchmark artifact must be measured, not a placeholder`)
    }
  }

  for (const metric of family.requiredScenarioCategories ?? []) {
    if (!(metric in (artifact.metrics ?? {}))) {
      throw new Error(`${family.id} benchmark artifact missing metric: ${metric}`)
    }
  }
}

function validateBaseline(baseline, family) {
  if (baseline.benchmark !== family.id || baseline.kind !== family.kinds?.[0]) {
    throw new Error(`${family.id} benchmark baseline must stay aligned with the canonical realistic benchmark contract`)
  }

  if (typeof baseline.updatedAt !== "string" || !baseline.regressions || typeof baseline.regressions !== "object") {
    throw new Error(`${family.id} benchmark baseline must define updatedAt plus metric regression constraints`)
  }

  for (const metric of family.requiredScenarioCategories ?? []) {
    if (!(metric in baseline.regressions)) {
      throw new Error(`${family.id} benchmark baseline missing regression guard: ${metric}`)
    }
  }
}
