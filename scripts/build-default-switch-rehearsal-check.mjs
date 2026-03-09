#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const dossier = readFileSync(join(repoRoot, "docs/BUILD_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")
const rehearsal = readFileSync(join(repoRoot, "docs/BUILD_DEFAULT_SWITCH_REHEARSAL.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

const script = packageJson.scripts?.["build:default:rehearsal"]
if (!script) throw new Error("missing build:default:rehearsal script")
for (const token of [
  "scripts/build-backend-parity.mjs",
  "tests/cli/programmatic-runtime.test.ts",
  "tests/build/init.test.ts",
  "tests/integration/production-backend-parity.test.ts",
  "scripts/build-dossier-check.mjs",
  "scripts/backend-default-switch-review-check.mjs",
]) {
  assertIncludes(script, token, `build:default:rehearsal script missing token: ${token}`)
}
for (const token of [
  "default-switch rehearsal: `scripts/build-default-switch-rehearsal-check.mjs`",
  "default-switch rehearsal status: green",
]) {
  assertIncludes(dossier, token, `Build dossier missing rehearsal token: ${token}`)
}
for (const token of [
  "Rehearsal Command",
  "bun run build:default:rehearsal",
  "Required Coverage",
  "Current Status",
  "rehearsal status: green",
]) {
  assertIncludes(rehearsal, token, `Build rehearsal doc missing token: ${token}`)
}
console.log("build:default:rehearsal OK")
