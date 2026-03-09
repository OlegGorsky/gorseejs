#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const roadmap = readFileSync(join(repoRoot, "docs/TOP_TIER_ROADMAP.md"), "utf-8")
const compilerBacklog = readFileSync(join(repoRoot, "docs/COMPILER_EXECUTION_BACKLOG.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

for (const [name, token] of [
  ["compiler:parity", "scripts/compiler-backend-parity.mjs"],
  ["compiler:canary", "tests/cli/programmatic-runtime.test.ts"],
  ["compiler:dossier:check", "scripts/compiler-dossier-check.mjs"],
  ["compiler:evidence:verify", "scripts/compiler-evidence-check.mjs"],
]) {
  const script = packageJson.scripts?.[name]
  if (!script) throw new Error(`missing ${name} script`)
  assertIncludes(script, token, `${name} script missing token: ${token}`)
}

for (const token of [
  "Backend Promotion Gates",
  "`oxc` is the canonical compiler default",
  "`compiler:parity`",
  "`compiler:canary`",
  "`compiler:evidence:verify`",
]) {
  assertIncludes(supportMatrix, token, `Support matrix missing compiler promotion token: ${token}`)
}

for (const token of [
  "Stage 4: Compiler Platform Closure",
  "preserve the current `oxc` and `rolldown` defaults",
]) {
  assertIncludes(roadmap, token, `Top-tier roadmap missing promotion token: ${token}`)
}

for (const token of [
  "oxc",
  "canonical compiler default path",
]) {
  assertIncludes(compilerBacklog, token, `Compiler backlog missing promotion token: ${token}`)
}

console.log("compiler:promotion OK")
