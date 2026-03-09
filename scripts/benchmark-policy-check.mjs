#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const benchmarkPolicy = readFileSync(join(repoRoot, "docs/BENCHMARK_POLICY.md"), "utf-8")
const reactiveBenchmarks = readFileSync(join(repoRoot, "docs/REACTIVE_BENCHMARKS.md"), "utf-8")
const methodologyDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_METHODOLOGY.md"), "utf-8")
const ssrProofDoc = readFileSync(join(repoRoot, "docs/SSR_BENCHMARK_PROOF.md"), "utf-8")
const domProofDoc = readFileSync(join(repoRoot, "docs/DOM_BENCHMARK_PROOF.md"), "utf-8")
const artifactsDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_ARTIFACTS.md"), "utf-8")
const releaseDisciplineDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_RELEASE_DISCIPLINE.md"), "utf-8")
const artifactSchema = JSON.parse(readFileSync(join(repoRoot, "benchmarks/benchmark-artifact.schema.json"), "utf-8"))
const realworldArtifact = JSON.parse(readFileSync(join(repoRoot, "benchmarks/realworld/artifact.json"), "utf-8"))
const realworldBaseline = JSON.parse(readFileSync(join(repoRoot, "benchmarks/realworld/baseline.json"), "utf-8"))
const ssrReadme = readFileSync(join(repoRoot, "benchmarks/ssr-throughput/README.md"), "utf-8")
const domReadme = readFileSync(join(repoRoot, "benchmarks/js-framework-bench/README.md"), "utf-8")
const realworldReadme = readFileSync(join(repoRoot, "benchmarks/realworld/README.md"), "utf-8")
const ssrPkg = JSON.parse(readFileSync(join(repoRoot, "benchmarks/ssr-throughput/package.json"), "utf-8"))
const domPkg = JSON.parse(readFileSync(join(repoRoot, "benchmarks/js-framework-bench/package.json"), "utf-8"))
const realworldPkg = JSON.parse(readFileSync(join(repoRoot, "benchmarks/realworld/package.json"), "utf-8"))

for (const token of [
  "Benchmark Policy",
  "mature product",
  "`benchmarks/ssr-throughput`",
  "`benchmarks/js-framework-bench`",
  "`benchmarks/realworld`",
  "evidence, not decoration",
  "clean, reproducible repository surface",
]) {
  assertIncludes(benchmarkPolicy, token, `benchmark policy missing token: ${token}`)
}

for (const [label, source, tokens] of [
  ["methodology", methodologyDoc, ["mature product", "Methodology Rules", "`benchmarks/ssr-throughput`", "`benchmarks/realworld`"]],
  ["ssr proof", ssrProofDoc, ["mature product", "What It Proves", "What It Does Not Prove", "`benchmarks/ssr-throughput`"]],
  ["dom proof", domProofDoc, ["mature product", "What It Proves", "What It Does Not Prove", "`benchmarks/js-framework-bench`"]],
  ["artifacts", artifactsDoc, ["mature product", "benchmark-artifact.schema.json", "`metrics`", "machine-readable"]],
  ["release discipline", releaseDisciplineDoc, ["mature product", "Release Discussion Rules", "Public Claim Threshold", "reproducible"]],
]) {
  for (const token of tokens) {
    assertIncludes(source, token, `${label} doc missing token: ${token}`)
  }
}

if (realworldArtifact.benchmark !== "realworld" || realworldArtifact.kind !== "fullstack-shape") {
  throw new Error("realworld benchmark artifact must stay aligned with the canonical realistic benchmark contract")
}

if (realworldBaseline.benchmark !== "realworld" || realworldBaseline.kind !== "fullstack-shape") {
  throw new Error("realworld benchmark baseline must stay aligned with the canonical realistic benchmark contract")
}

if (typeof realworldBaseline.updatedAt !== "string" || !realworldBaseline.regressions || typeof realworldBaseline.regressions !== "object") {
  throw new Error("realworld benchmark baseline must define updatedAt plus metric regression constraints")
}

if (typeof realworldArtifact.notes !== "string" || realworldArtifact.notes.includes("sample artifact")) {
  throw new Error("realworld benchmark artifact must be measured, not a sample placeholder")
}

for (const token of [
  "`benchmarks/ssr-throughput`",
  "`benchmarks/js-framework-bench`",
  "`benchmarks/realworld`",
  "Interpretation Rules",
  "Current Gaps",
  "Realistic Evidence Contract",
  "baseline.json",
  "regression gate",
  "Benchmark Methodology",
  "SSR Benchmark Proof",
  "DOM Benchmark Proof",
]) {
  assertIncludes(reactiveBenchmarks, token, `reactive benchmarks doc missing token: ${token}`)
}

for (const field of ["benchmark", "kind", "ts", "environment", "metrics"]) {
  if (!artifactSchema.required?.includes(field)) {
    throw new Error(`benchmark artifact schema missing required field: ${field}`)
  }
}

for (const [label, source, tokens] of [
  ["ssr benchmark README", ssrReadme, ["bench:ssr", "bench:size", "bench"]],
  ["dom benchmark README", domReadme, ["bun run dev", "bun run bench"]],
  ["realworld README", realworldReadme, ["auth", "SSR", "signals"]],
]) {
  for (const token of tokens) {
    assertIncludes(source, token, `${label} missing token: ${token}`)
  }
}

expectScript(ssrPkg, "bench")
expectScript(ssrPkg, "bench:ssr")
expectScript(ssrPkg, "bench:size")
expectScript(domPkg, "dev")
expectScript(domPkg, "build")
expectScript(domPkg, "bench")
expectScript(realworldPkg, "dev")
expectScript(realworldPkg, "build")
expectScript(realworldPkg, "start")
expectScript(realworldPkg, "seed")
expectScript(realworldPkg, "bench:artifact")

for (const benchmarkDir of [
  join(repoRoot, "benchmarks", "ssr-throughput"),
  join(repoRoot, "benchmarks", "js-framework-bench"),
  join(repoRoot, "benchmarks", "realworld"),
]) {
  assertNoForbiddenArtifacts(benchmarkDir, `benchmark ${relative(repoRoot, benchmarkDir)}`)
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
