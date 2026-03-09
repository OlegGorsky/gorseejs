#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const dossier = readFileSync(join(repoRoot, "docs/BUILD_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

for (const scriptName of [
  "build:parity",
  "build:canary",
  "build:promotion:check",
  "build:evidence:verify",
  "backend:switch:evidence:check",
]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing build dossier script: ${scriptName}`)
  }
}

for (const token of [
  "Current default:",
  "Previous default:",
  "Required Evidence",
  "Evidence References",
  "scripts/build-backend-parity.mjs",
  "scripts/build-canary-check.mjs",
  "tests/cli/programmatic-runtime.test.ts",
  "tests/integration/production-backend-parity.test.ts",
  "tests/build/artifact-parity.test.ts",
  "Default-Switch Blockers",
  "current decision: go for default switch",
]) {
  assertIncludes(dossier, token, `Build dossier missing token: ${token}`)
}

console.log("build:dossier OK")
