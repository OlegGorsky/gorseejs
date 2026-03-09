#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const releasePolicy = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const evidenceDoc = readFileSync(join(repoRoot, "docs/BACKEND_SWITCH_EVIDENCE.md"), "utf-8")
const roadmap = readFileSync(join(repoRoot, "docs/TOP_TIER_ROADMAP.md"), "utf-8")
const compilerDossier = readFileSync(join(repoRoot, "docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")
const buildDossier = readFileSync(join(repoRoot, "docs/BUILD_DEFAULT_SWITCH_DOSSIER.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

for (const scriptName of [
  "compiler:parity",
  "compiler:canary",
  "compiler:promotion:check",
  "build:parity",
  "build:canary",
  "build:promotion:check",
]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing backend switch evidence script: ${scriptName}`)
  }
}

for (const token of [
  "Compiler Default Switch",
  "`oxc` has replaced `typescript` as the canonical compiler default because",
  "Build Default Switch",
  "`rolldown` has replaced `bun` as the canonical build default because",
  "No-Go Conditions",
  "release-policy violation",
]) {
  assertIncludes(evidenceDoc, token, `Backend switch evidence doc missing token: ${token}`)
}

for (const [label, source, tokens] of [
  ["COMPILER_DEFAULT_SWITCH_DOSSIER", compilerDossier, [
    "Current default:",
    "Previous default:",
    "Required Evidence",
    "Go / No-Go",
    "current decision: go for default switch",
  ]],
  ["BUILD_DEFAULT_SWITCH_DOSSIER", buildDossier, [
    "Current default:",
    "Previous default:",
    "Required Evidence",
    "Go / No-Go",
    "current decision: go for default switch",
  ]],
]) {
  for (const token of tokens) {
    assertIncludes(source, token, `${label} missing token: ${token}`)
  }
}

for (const token of [
  "`oxc` is the canonical compiler default",
  "`rolldown` is the canonical build default",
]) {
  assertIncludes(supportMatrix, token, `Support matrix missing backend switch token: ${token}`)
}

for (const token of [
  "compiler:promotion:check",
  "build:promotion:check",
]) {
  assertIncludes(releasePolicy, token, `Release policy missing backend switch token: ${token}`)
}

for (const token of [
  "Stage 4: Compiler Platform Closure",
  "preserve the current `oxc` and `rolldown` defaults",
]) {
  assertIncludes(roadmap, token, `Top-tier roadmap missing backend switch token: ${token}`)
}

console.log("backend:switch:evidence OK")
