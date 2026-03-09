#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const dossier = readFileSync(join(repoRoot, "docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")
const rehearsal = readFileSync(join(repoRoot, "docs/COMPILER_DEFAULT_SWITCH_REHEARSAL.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

const script = packageJson.scripts?.["compiler:default:rehearsal"]
if (!script) throw new Error("missing compiler:default:rehearsal script")
for (const token of [
  "scripts/compiler-backend-parity.mjs",
  "tests/cli/programmatic-runtime.test.ts",
  "tests/compiler/init.test.ts",
  "scripts/compiler-dossier-check.mjs",
  "scripts/backend-default-switch-review-check.mjs",
]) {
  assertIncludes(script, token, `compiler:default:rehearsal script missing token: ${token}`)
}
for (const token of [
  "default-switch rehearsal: `scripts/compiler-default-switch-rehearsal-check.mjs`",
  "default-switch rehearsal status: green",
]) {
  assertIncludes(dossier, token, `Compiler dossier missing rehearsal token: ${token}`)
}
for (const token of [
  "Rehearsal Command",
  "bun run compiler:default:rehearsal",
  "Required Coverage",
  "Current Status",
  "rehearsal status: green",
]) {
  assertIncludes(rehearsal, token, `Compiler rehearsal doc missing token: ${token}`)
}
console.log("compiler:default:rehearsal OK")
