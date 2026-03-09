#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"))
const supportMatrixDoc = readFileSync(resolve(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message)
  }
}

const buildCanaryScript = packageJson.scripts?.["build:canary"]
if (!buildCanaryScript) {
  throw new Error("missing build:canary script")
}

for (const token of [
  "scripts/build-backend-parity.mjs",
  "tests/cli/programmatic-runtime.test.ts",
  "tests/build/init.test.ts",
  "tests/integration/production-backend-parity.test.ts",
]) {
  assertIncludes(buildCanaryScript, token, `build:canary script missing token: ${token}`)
}

for (const token of [
  "`rolldown` is the canonical build default",
]) {
  assertIncludes(supportMatrixDoc, token, `support matrix missing build canary token: ${token}`)
}

console.log("build:canary OK")
