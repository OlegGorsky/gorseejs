#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const plan = readFileSync(join(repoRoot, "docs/COMPILER_SWITCH_EVIDENCE_PLAN.md"), "utf-8")
const dossier = readFileSync(join(repoRoot, "docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

const script = packageJson.scripts?.["compiler:evidence:verify"]
if (!script) throw new Error("missing compiler:evidence:verify script")

for (const token of [
  "bun run compiler:parity",
  "tests/cli/cmd-docs.test.ts",
  "tests/cli/cmd-check.test.ts",
  "tests/cli/programmatic-runtime.test.ts",
  "tests/compiler/init.test.ts",
  "tests/compiler/module-analysis-parity.test.ts",
  "tests/compiler/oxc.test.ts",
  "tests/compiler/route-facts-contract.test.ts",
  "scripts/compiler-dossier-check.mjs",
  "scripts/compiler-promotion-check.mjs",
]) {
  assertIncludes(script, token, `compiler:evidence:verify script missing token: ${token}`)
}

for (const token of [
  "Run `bun run compiler:evidence:verify` as the canonical compiler verification train.",
  "module-analysis parity remains green on the canonical compiler path",
  "route facts artifacts remain versioned and machine-readable on the canonical compiler path",
  "CLI docs generation remains green on the canonical compiler path",
  "CLI project checks remain green on the canonical compiler path",
  "programmatic runtime flows remain green on the canonical compiler path",
  "backend init/selection remains green on the canonical compiler path",
  "repeated green `compiler:evidence:verify` runs on the canonical path",
]) {
  assertIncludes(plan, token, `compiler evidence plan missing token: ${token}`)
}

for (const token of [
  "Evidence References",
  "scripts/compiler-backend-parity.mjs",
  "scripts/compiler-canary-check.mjs",
  "scripts/compiler-default-switch-rehearsal-check.mjs",
]) {
  assertIncludes(dossier, token, `compiler dossier missing evidence token: ${token}`)
}

console.log("compiler:evidence OK")
