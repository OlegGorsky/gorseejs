#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const review = readFileSync(join(repoRoot, "docs/BACKEND_DEFAULT_SWITCH_REVIEW.md"), "utf-8")
const compilerDossier = readFileSync(join(repoRoot, "docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")
const buildDossier = readFileSync(join(repoRoot, "docs/BUILD_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

for (const scriptName of [
  "compiler:dossier:check",
  "build:dossier:check",
  "backend:switch:evidence:check",
]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing backend default switch review script: ${scriptName}`)
  }
}

for (const token of [
  "Current Decision",
  "compiler default switch: go",
  "build default switch: go",
  "unified release decision: go",
  "Inputs",
  "Compiler Review",
  "Build Review",
  "Go / No-Go Rule",
  "final operator checkpoint",
]) {
  assertIncludes(review, token, `Backend default switch review missing token: ${token}`)
}

assertIncludes(compilerDossier, "current decision: go for default switch", "Compiler dossier must stay explicit about current decision")
assertIncludes(buildDossier, "current decision: go for default switch", "Build dossier must stay explicit about current decision")

console.log("backend:default-switch:review OK")
