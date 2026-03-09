#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const sampleArtifact = JSON.parse(readFileSync(join(repoRoot, "benchmarks/realworld/artifact.json"), "utf-8"))
const baseline = JSON.parse(readFileSync(join(repoRoot, "benchmarks/realworld/baseline.json"), "utf-8"))
const schema = JSON.parse(readFileSync(join(repoRoot, "benchmarks/benchmark-artifact.schema.json"), "utf-8"))
const measurementGapsDoc = readFileSync(join(repoRoot, "docs/REACTIVE_MEASUREMENT_GAPS.md"), "utf-8")
const benchmarksDoc = readFileSync(join(repoRoot, "docs/REACTIVE_BENCHMARKS.md"), "utf-8")

for (const field of schema.required ?? []) {
  if (!(field in sampleArtifact)) {
    throw new Error(`realworld benchmark artifact missing required field: ${field}`)
  }
}

if (sampleArtifact.benchmark !== "realworld") {
  throw new Error(`realworld benchmark artifact must declare benchmark=realworld, received ${String(sampleArtifact.benchmark)}`)
}

if (sampleArtifact.kind !== "fullstack-shape") {
  throw new Error(`realworld benchmark artifact must declare kind=fullstack-shape, received ${String(sampleArtifact.kind)}`)
}

if (baseline.benchmark !== "realworld" || baseline.kind !== "fullstack-shape") {
  throw new Error("realworld benchmark baseline must stay aligned with the canonical realistic benchmark contract")
}

if (typeof sampleArtifact.notes !== "string" || sampleArtifact.notes.includes("sample artifact")) {
  throw new Error("realworld benchmark artifact must contain measured-not-sample notes")
}

for (const metric of [
  "scenarioCount",
  "contentRouteTtfbMs",
  "multiIslandHydrationMs",
  "resourceRouteRenderMs",
  "mutationRollbackMs",
  "workspaceBuildMs",
]) {
  if (typeof sampleArtifact.metrics?.[metric] !== "number") {
    throw new Error(`realworld benchmark artifact missing numeric metric: ${metric}`)
  }
}

for (const [metric, constraint] of Object.entries(baseline.regressions ?? {})) {
  const measured = sampleArtifact.metrics?.[metric]
  if (typeof measured !== "number") {
    throw new Error(`realworld benchmark artifact cannot evaluate regression gate for missing metric: ${metric}`)
  }
  if (typeof constraint.min === "number" && measured < constraint.min) {
    throw new Error(`realworld benchmark regression: ${metric}=${measured} is below baseline min ${constraint.min}`)
  }
  if (typeof constraint.max === "number" && measured > constraint.max) {
    throw new Error(`realworld benchmark regression: ${metric}=${measured} exceeds baseline max ${constraint.max}`)
  }
}

for (const token of [
  "content-heavy routes",
  "multi-island dashboards",
  "resource-heavy routes",
  "mutation-heavy UIs",
  "workspace-scale apps",
  "baseline.json",
  "regression gate",
]) {
  if (!benchmarksDoc.includes(token)) {
    throw new Error(`reactive benchmarks doc missing realistic app-shape token: ${token}`)
  }
}

for (const token of [
  "Evidence Backed Baselines",
  "Remaining Gaps",
  "route-wide hydration versus island-only hydration",
  "many concurrent `createResource` instances",
  "optimistic update pressure under repeated writes",
  "larger numbers of focused islands on one route",
]) {
  if (!measurementGapsDoc.includes(token)) {
    throw new Error(`measurement gaps doc missing token: ${token}`)
  }
}

console.log("realworld:benchmark:check OK")
