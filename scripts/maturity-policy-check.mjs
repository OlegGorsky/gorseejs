#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const agentsDoc = readFileSync(join(repoRoot, "AGENTS.md"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const releasePolicy = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const releaseChecklist = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const roadmap = readFileSync(join(repoRoot, "docs/TOP_TIER_ROADMAP.md"), "utf-8")

const docs = [
  ["docs/MATURITY_POLICY.md", ["mature product", "Core Rules", "support claims", "release discipline"]],
  ["docs/DEPENDENCY_POLICY.md", ["mature product", "prefer no new dependency", "dependency-light runtime identity"]],
  ["docs/COMPATIBILITY_GUARDRAILS.md", ["mature product", "root `gorsee`", "`gorsee/client`", "`gorsee/server`"]],
  ["docs/AMBIGUITY_POLICY.md", ["mature product", "one clear path", "Ambiguity Signals", "product defect"]],
  ["docs/DX_FEEDBACK_LOOP.md", ["mature product", "Feedback Loop", "recurring friction", "tribal knowledge"]],
  ["docs/EVIDENCE_POLICY.md", ["mature product", "Evidence Sources", "benchmark docs", "release smoke"]],
  ["docs/ROADMAP_COMPLETION_POLICY.md", ["mature product", "Completion Rule", "Not Enough", "aspirational wording"]],
]

if (!packageJson.scripts?.["maturity:policy"]?.includes("maturity-policy-check.mjs")) {
  throw new Error("missing maturity:policy script")
}

for (const token of [
  "Maturity Policy",
  "Dependency Policy",
  "Compatibility Guardrails",
  "Ambiguity Policy",
  "DX Feedback Loop",
  "Evidence Policy",
  "Roadmap Completion Policy",
]) {
  assertIncludes(readme, token, `README missing maturity reference: ${token}`)
}

for (const [relativePath, tokens] of docs) {
  const source = readFileSync(join(repoRoot, relativePath), "utf-8")
  for (const token of tokens) {
    assertIncludes(source, token, `${relativePath} missing token: ${token}`)
  }
}

assertIncludes(agentsDoc, "docs/MATURITY_POLICY.md", "AGENTS must reference maturity policy")
assertIncludes(agentsDoc, "docs/DEPENDENCY_POLICY.md", "AGENTS must reference dependency policy")
assertIncludes(ciPolicy, "Maturity Surface", "CI policy must define maturity surface")
assertIncludes(ciPolicy, "bun run maturity:policy", "CI policy must require maturity:policy")
assertIncludes(releasePolicy, "docs/EVIDENCE_POLICY.md", "Release policy must reference evidence policy")
assertIncludes(releaseChecklist, "docs/ROADMAP_COMPLETION_POLICY.md", "Release checklist must reference roadmap completion policy")
assertIncludes(roadmap, "Stage 6: Performance Evidence on Realistic Apps", "Top-tier roadmap must include stage 6")
assertIncludes(roadmap, "Implementation Order", "Top-tier roadmap must define implementation order")

console.log("maturity:policy OK")

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}
