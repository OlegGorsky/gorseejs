#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const dossier = readFileSync(join(repoRoot, "docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

for (const scriptName of [
  "compiler:parity",
  "compiler:canary",
  "compiler:promotion:check",
  "compiler:evidence:verify",
  "backend:switch:evidence:check",
]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing compiler dossier script: ${scriptName}`)
  }
}

for (const token of [
  "Current default:",
  "Previous default:",
  "Required Evidence",
  "Evidence References",
  "scripts/compiler-backend-parity.mjs",
  "scripts/compiler-canary-check.mjs",
  "tests/cli/programmatic-runtime.test.ts",
  "tests/compiler/init.test.ts",
  ".gorsee/route-facts.json",
  "Default-Switch Blockers",
  "current decision: go for default switch",
]) {
  assertIncludes(dossier, token, `Compiler dossier missing token: ${token}`)
}

console.log("compiler:dossier OK")
