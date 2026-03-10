#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const roadmap = readFileSync(join(repoRoot, "docs/TOP_TIER_ROADMAP.md"), "utf-8")
const maturityPolicy = readFileSync(join(repoRoot, "docs/MATURITY_POLICY.md"), "utf-8")
const completionPolicy = readFileSync(join(repoRoot, "docs/ROADMAP_COMPLETION_POLICY.md"), "utf-8")
const releasePolicy = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const releaseChecklist = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const exitGate = readFileSync(join(repoRoot, "docs/TOP_TIER_EXIT_GATE.md"), "utf-8")

if (!packageJson.scripts?.["top-tier:exit"]?.includes("top-tier-exit-check.mjs")) {
  throw new Error("missing top-tier:exit script")
}

for (const token of [
  "Top-Tier Exit Gate",
  "Roadmap Completion Policy",
  "Maturity Policy",
  "Release Policy",
]) {
  assertIncludes(readme, token, `README missing top-tier exit token: ${token}`)
}

for (const token of [
  "Top-Tier Exit Gate",
  "What Changes After Exit",
  "Reopen Rule",
  "maintenance of an existing contract",
  "deliberate platform evolution",
]) {
  assertIncludes(exitGate, token, `top-tier exit gate doc missing token: ${token}`)
}

assertIncludes(roadmap, "Roadmap Closure", "Top-tier roadmap must define roadmap closure")
assertIncludes(roadmap, "baseline top-tier maturity plan is complete", "Top-tier roadmap must declare baseline completion")
assertIncludes(maturityPolicy, "docs/TOP_TIER_EXIT_GATE.md", "Maturity policy must reference top-tier exit gate")
assertIncludes(completionPolicy, "docs/TOP_TIER_EXIT_GATE.md", "Roadmap completion policy must reference top-tier exit gate")
assertIncludes(releasePolicy, "docs/TOP_TIER_EXIT_GATE.md", "Release policy must reference top-tier exit gate")
assertIncludes(releaseChecklist, "docs/TOP_TIER_EXIT_GATE.md", "Release checklist must reference top-tier exit gate")

console.log("top-tier:exit OK")

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}
