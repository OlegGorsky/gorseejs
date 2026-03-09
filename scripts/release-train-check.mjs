#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const policyDoc = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const channelScript = readFileSync(join(repoRoot, "scripts/release-channel-check.mjs"), "utf-8")
const releaseWorkflow = readFileSync(join(repoRoot, ".github/workflows/release-train.yml"), "utf-8")

const requiredScripts = [
  "release:stable:check",
  "release:canary:check",
  "release:rc:check",
  "release:version:stable",
  "release:version:canary",
  "release:version:rc",
  "release:checklist:check",
  "release:check",
  "install:matrix",
  "release:smoke",
  "compiler:promotion:check",
  "build:promotion:check",
  "backend:switch:evidence:check",
  "backend:default-switch:review:check",
  "backend:candidate:rollout:check",
  "backend:candidate:verify",
  "compiler:default:rehearsal:check",
  "build:default:rehearsal:check",
  "product:policy",
  "ai:policy",
  "dx:policy",
  "maturity:policy",
  "runtime:policy",
  "test:provider-smoke",
  "test:browser-smoke",
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

const checklistDoc = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
for (const section of ["Stable", "Canary", "Release Candidate", "Invariants"]) {
  if (!checklistDoc.includes(section)) {
    throw new Error(`release checklist doc missing section: ${section}`)
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
]) {
  if (!releaseWorkflow.includes(token)) {
    throw new Error(`release workflow missing widened matrix token: ${token}`)
  }
}

console.log(`release:train:check OK (${packageJson.version})`)
