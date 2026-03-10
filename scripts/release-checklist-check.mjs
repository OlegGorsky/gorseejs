#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const releaseContract = JSON.parse(readFileSync(join(repoRoot, "docs/RELEASE_CONTRACT.json"), "utf-8"))
const checklistDoc = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const policyDoc = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")

if (releaseContract.version !== 1) {
  throw new Error(`release contract version must be 1, received ${String(releaseContract.version)}`)
}

const requiredScripts = [
  ...releaseContract.requiredPolicyScripts,
  ...releaseContract.requiredReleaseScripts,
  ...releaseContract.channels.flatMap((channel) => [channel.checkScript, channel.versionScript]),
  "verify:security",
  "release:extension",
]

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing release checklist script: ${scriptName}`)
  }
}

for (const token of [
  "docs/APPLICATION_MODES.md",
  "docs/API_STABILITY.md",
  "docs/SUPPORT_MATRIX.md",
  "docs/DEPRECATION_POLICY.md",
  "docs/RELEASE_CONTRACT.json",
  "bun run verify:security",
  "bun run api:policy",
  "bun run adoption:policy",
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
  "app.mode",
  "runtime.topology",
]) {
  if (!checklistDoc.includes(token)) {
    throw new Error(`release checklist missing token: ${token}`)
  }
}

for (const token of releaseContract.modeContextRequirements ?? []) {
  if (!checklistDoc.includes(token) && !policyDoc.includes(token)) {
    throw new Error(`release docs missing mode-context requirement: ${token}`)
  }
}

for (const section of ["Stable", "Canary", "Release Candidate", "Invariants", "Tooling"]) {
  if (!policyDoc.includes(section) && !checklistDoc.includes(section)) {
    throw new Error(`release docs missing section: ${section}`)
  }
}

console.log(`release:checklist:check OK (${packageJson.version})`)
