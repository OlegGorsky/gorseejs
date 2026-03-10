#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const releaseContract = JSON.parse(readFileSync(join(repoRoot, "docs/RELEASE_CONTRACT.json"), "utf-8"))
const policyDoc = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const channelScript = readFileSync(join(repoRoot, "scripts/release-channel-check.mjs"), "utf-8")
const releaseWorkflow = readFileSync(join(repoRoot, ".github/workflows/release-train.yml"), "utf-8")

if (releaseContract.version !== 1) {
  throw new Error(`release contract version must be 1, received ${String(releaseContract.version)}`)
}

const requiredScripts = [
  ...releaseContract.channels.flatMap((channel) => [channel.checkScript, channel.versionScript]),
  ...releaseContract.requiredReleaseScripts,
  ...releaseContract.requiredPolicyScripts,
  ...releaseContract.requiredVerificationScripts,
]

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing release train script: ${scriptName}`)
  }
}

for (const section of ["Stable", "Canary", "Release Candidate"]) {
  if (!policyDoc.includes(section)) {
    throw new Error(`release policy doc missing section: ${section}`)
  }
}

for (const token of ["docs/RELEASE_CONTRACT.json", "docs/APPLICATION_MODES.md", "api:policy", "adoption:policy", "critical:surface", "app.mode", "runtime.topology"]) {
  if (!policyDoc.includes(token)) {
    throw new Error(`release policy doc missing contract token: ${token}`)
  }
}

const checklistDoc = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
for (const section of ["Stable", "Canary", "Release Candidate", "Invariants"]) {
  if (!checklistDoc.includes(section)) {
    throw new Error(`release checklist doc missing section: ${section}`)
  }
}

for (const token of releaseContract.modeContextRequirements ?? []) {
  if (!policyDoc.includes(token) && !checklistDoc.includes(token)) {
    throw new Error(`release docs missing mode-context requirement: ${token}`)
  }
}

const versionPlanner = readFileSync(join(repoRoot, "scripts/release-version-plan.mjs"), "utf-8")

for (const token of ["stable", "canary", "rc"]) {
  if (!channelScript.includes(token)) {
    throw new Error(`release channel check script missing channel rule: ${token}`)
  }
  if (!versionPlanner.includes(token)) {
    throw new Error(`release version planner missing channel rule: ${token}`)
  }
}

for (const token of [
  "ubuntu-latest",
  "macos-latest",
  "windows-latest",
  "chromium",
  "firefox",
  "webkit",
  "PLAYWRIGHT_BROWSER: ${{ matrix.browser }}",
  "bun run api:policy",
  "bun run adoption:policy",
  "bun run critical:surface",
  "bun run test:critical-surface",
]) {
  if (!releaseWorkflow.includes(token)) {
    throw new Error(`release workflow missing widened matrix token: ${token}`)
  }
}

console.log(`release:train:check OK (${packageJson.version})`)
