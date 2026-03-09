#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const checklistDoc = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const policyDoc = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")

const requiredScripts = [
  "product:policy",
  "verify:security",
  "release:extension",
  "release:check",
  "release:smoke",
  "release:stable:check",
  "release:canary:check",
  "release:rc:check",
  "release:version:stable",
  "release:version:canary",
  "release:version:rc",
  "compiler:promotion:check",
  "build:promotion:check",
  "backend:switch:evidence:check",
  "backend:default-switch:review:check",
  "backend:candidate:rollout:check",
  "backend:candidate:verify",
  "compiler:default:rehearsal:check",
  "build:default:rehearsal:check",
]

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing release checklist script: ${scriptName}`)
  }
}

for (const token of [
  "docs/API_STABILITY.md",
  "docs/SUPPORT_MATRIX.md",
  "docs/DEPRECATION_POLICY.md",
  "bun run verify:security",
  "npm run release:extension",
  "npm run release:check",
  "npm run release:smoke",
  "bun run release:stable:check",
  "bun run release:canary:check",
  "bun run release:rc:check",
  "bun run compiler:promotion:check",
  "bun run build:promotion:check",
  "bun run backend:switch:evidence:check",
  "bun run backend:default-switch:review:check",
  "bun run backend:candidate:rollout:check",
  "bun run backend:candidate:verify",
  "bun run compiler:default:rehearsal:check",
  "bun run build:default:rehearsal:check",
  "scripts/release-version-plan.mjs canary",
  "scripts/release-version-plan.mjs rc",
]) {
  if (!checklistDoc.includes(token)) {
    throw new Error(`release checklist missing token: ${token}`)
  }
}

for (const section of ["Stable", "Canary", "Release Candidate", "Invariants", "Tooling"]) {
  if (!policyDoc.includes(section) && !checklistDoc.includes(section)) {
    throw new Error(`release docs missing section: ${section}`)
  }
}

console.log(`release:checklist:check OK (${packageJson.version})`)
