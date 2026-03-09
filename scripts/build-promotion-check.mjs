#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"))
const supportMatrix = readFileSync(resolve(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf8")
const compilerBacklog = readFileSync(resolve(repoRoot, "docs/COMPILER_EXECUTION_BACKLOG.md"), "utf8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

for (const [name, token] of [
  ["build:parity", "scripts/build-backend-parity.mjs"],
  ["build:canary", "tests/integration/production-backend-parity.test.ts"],
  ["build:dossier:check", "scripts/build-dossier-check.mjs"],
  ["build:evidence:verify", "scripts/build-evidence-check.mjs"],
]) {
  const script = packageJson.scripts?.[name]
  if (!script) throw new Error(`missing ${name} script`)
  assertIncludes(script, token, `${name} script missing token: ${token}`)
}

for (const token of [
  "Backend Promotion Gates",
  "`rolldown` is the canonical build default",
  "`build:parity`",
  "`build:canary`",
  "`build:evidence:verify`",
  "production runtime smoke parity",
]) {
  assertIncludes(supportMatrix, token, `Support matrix missing build promotion token: ${token}`)
}

for (const token of [
  "rolldown",
  "canonical build default",
  "production runtime smoke parity",
]) {
  assertIncludes(compilerBacklog, token, `Compiler backlog missing build promotion token: ${token}`)
}

console.log("build:promotion OK")
