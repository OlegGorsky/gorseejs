#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const plan = readFileSync(join(repoRoot, "docs/BUILD_SWITCH_EVIDENCE_PLAN.md"), "utf-8")
const dossier = readFileSync(join(repoRoot, "docs/BUILD_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

const script = packageJson.scripts?.["build:evidence:verify"]
if (!script) throw new Error("missing build:evidence:verify script")

for (const token of [
  "bun run build:parity",
  "tests/build/artifact-parity.test.ts",
  "tests/build/build-diagnostics.test.ts",
  "tests/cli/programmatic-runtime.test.ts",
  "tests/build/init.test.ts",
  "tests/integration/production-backend-parity.test.ts",
  "scripts/build-dossier-check.mjs",
  "scripts/build-promotion-check.mjs",
]) {
  assertIncludes(script, token, `build:evidence:verify script missing token: ${token}`)
}

for (const token of [
  "Run `bun run build:evidence:verify` as the canonical build verification train.",
  "artifact parity remains green for manifest, prerendered routes, client assets, and CSS-module artifacts",
  "emitted output surface parity remains green for canonical build fixtures",
  "structured backend diagnostics remain actionable on the canonical build path",
  "programmatic build/runtime flows remain green on the canonical build path",
  "backend init/selection remains green on the canonical build path",
  "production runtime smoke parity remains green on the canonical build path",
  "repeated green `build:evidence:verify` runs on the canonical path",
]) {
  assertIncludes(plan, token, `build evidence plan missing token: ${token}`)
}

for (const token of [
  "Evidence References",
  "scripts/build-backend-parity.mjs",
  "scripts/build-canary-check.mjs",
  "scripts/build-default-switch-rehearsal-check.mjs",
]) {
  assertIncludes(dossier, token, `build dossier missing evidence token: ${token}`)
}

console.log("build:evidence OK")
