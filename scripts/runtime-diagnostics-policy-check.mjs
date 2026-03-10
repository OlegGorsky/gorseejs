#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const diagnosticsContract = JSON.parse(readFileSync(join(repoRoot, "docs/DIAGNOSTICS_CONTRACT.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const releasePolicy = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const releaseChecklist = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const buildDiagnostics = readFileSync(join(repoRoot, "docs/BUILD_DIAGNOSTICS.md"), "utf-8")
const runtimeFailures = readFileSync(join(repoRoot, "docs/RUNTIME_FAILURES.md"), "utf-8")
const cacheInvalidation = readFileSync(join(repoRoot, "docs/CACHE_INVALIDATION.md"), "utf-8")
const streamingHydrationFailures = readFileSync(join(repoRoot, "docs/STREAMING_HYDRATION_FAILURES.md"), "utf-8")
const runtimeTriage = readFileSync(join(repoRoot, "docs/RUNTIME_TRIAGE.md"), "utf-8")
const starterFailures = readFileSync(join(repoRoot, "docs/STARTER_FAILURES.md"), "utf-8")
const releaseSmoke = readFileSync(join(repoRoot, "scripts/release-smoke.mjs"), "utf-8")
const frameworkGenerator = readFileSync(join(repoRoot, "src/cli/framework-md.ts"), "utf-8")
const starterGenerator = readFileSync(join(repoRoot, "src/cli/cmd-create.ts"), "utf-8")

if (!packageJson.scripts?.["runtime:policy"]?.includes("runtime-diagnostics-policy-check.mjs")) {
  throw new Error("missing runtime:policy script")
}

if (diagnosticsContract.version !== 1) {
  throw new Error(`diagnostics contract version must be 1, received ${String(diagnosticsContract.version)}`)
}

for (const token of [
  "Build Diagnostics",
  "Runtime Failures",
  "Cache Invalidation",
  "Streaming and Hydration Failures",
  "Runtime Triage",
  "Starter Failures",
  "Diagnostics Contract",
]) {
  assertIncludes(readme, token, `README missing runtime diagnostics reference: ${token}`)
}

for (const [label, source, tokens] of [
  ["BUILD_DIAGNOSTICS", buildDiagnostics, ["mature product", "missing client bundle", "hashed route bundle", "release smoke", "`backend`", "`phase`", "`code`"]],
  ["RUNTIME_FAILURES", runtimeFailures, ["mature product", "Missing trusted origin for production runtime", "route/document/partial", "request.error"]],
  ["CACHE_INVALIDATION", cacheInvalidation, ["mature product", "`private`", "`public`", "`no-store`"]],
  ["STREAMING_HYDRATION_FAILURES", streamingHydrationFailures, ["mature product", "wrapHTML", "smallest hydration boundary", "X-Gorsee-Navigate: partial"]],
  ["RUNTIME_TRIAGE", runtimeTriage, ["mature product", "bun run test:confidence", "gorsee ai doctor", ".gorsee/agent/latest.json"]],
  ["STARTER_FAILURES", starterFailures, ["mature product", "APP_ORIGIN", "security.rpc.middlewares", "docs/RUNTIME_FAILURES.md"]],
]) {
  for (const token of tokens) {
    assertIncludes(source, token, `${label} missing token: ${token}`)
  }
}

assertIncludes(ciPolicy, "bun run runtime:policy", "CI policy must require runtime:policy")
assertIncludes(ciPolicy, "Runtime Diagnostics Surface", "CI policy must define runtime diagnostics surface")
assertIncludes(ciPolicy, "docs/DIAGNOSTICS_CONTRACT.json", "CI policy must reference diagnostics contract")
assertIncludes(releasePolicy, "docs/RUNTIME_FAILURES.md", "Release policy must reference runtime failures doc")
assertIncludes(releaseChecklist, "docs/RUNTIME_TRIAGE.md", "Release checklist must reference runtime triage doc")
assertIncludes(frameworkGenerator, "docs/RUNTIME_FAILURES.md", "FRAMEWORK.md generator must link runtime failures")
assertIncludes(frameworkGenerator, "docs/RUNTIME_TRIAGE.md", "FRAMEWORK.md generator must link runtime triage")
assertIncludes(starterGenerator, "docs/CACHE_INVALIDATION.md", "starter README must link cache invalidation guidance")
assertIncludes(releaseSmoke, "docs/RUNTIME_FAILURES.md", "release smoke must validate runtime failure guidance")
assertIncludes(releaseSmoke, "docs/STARTER_FAILURES.md", "release smoke must validate starter failure guidance")

for (const token of diagnosticsContract.triageOrder ?? []) {
  assertIncludes(runtimeTriage, token, `runtime triage missing diagnostics contract token: ${token}`)
}

for (const token of diagnosticsContract.recommendedCommands ?? []) {
  assertIncludes(runtimeTriage, token, `runtime triage missing recommended command: ${token}`)
}

for (const token of diagnosticsContract.buildArtifacts ?? []) {
  assertIncludes(buildDiagnostics, token, `build diagnostics missing artifact token: ${token}`)
}

for (const token of diagnosticsContract.aiArtifacts ?? []) {
  assertIncludes(runtimeFailures, token, `runtime failures missing AI artifact token: ${token}`)
}

for (const token of diagnosticsContract.modeContextSignals ?? []) {
  assertIncludes(runtimeTriage, token, `runtime triage missing mode-context token: ${token}`)
  if (token !== "AI app context") {
    assertIncludes(runtimeFailures, token, `runtime failures missing mode-context token: ${token}`)
    assertIncludes(aiWorkflowsLike(), token, `AI workflows missing mode-context token: ${token}`)
  }
}

for (const token of diagnosticsContract.incidentSignals ?? []) {
  assertIncludes(runtimeFailures, token, `runtime failures missing incident signal token: ${token}`)
}

console.log("runtime:policy OK")

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}

function aiWorkflowsLike() {
  return readFileSync(join(repoRoot, "docs/AI_WORKFLOWS.md"), "utf-8")
}
