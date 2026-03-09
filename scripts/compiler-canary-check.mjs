#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const roadmap = readFileSync(join(repoRoot, "docs/TOP_TIER_ROADMAP.md"), "utf-8")
const compilerBacklog = readFileSync(join(repoRoot, "docs/COMPILER_EXECUTION_BACKLOG.md"), "utf-8")

const canaryScript = packageJson.scripts?.["compiler:canary"]
if (!canaryScript) {
  throw new Error("missing compiler:canary script")
}

for (const token of [
  "scripts/compiler-backend-parity.mjs",
  "tests/cli/programmatic-runtime.test.ts",
]) {
  if (!canaryScript.includes(token)) {
    throw new Error(`compiler:canary script missing token: ${token}`)
  }
}

for (const [label, source, tokens] of [
  ["SUPPORT_MATRIX", supportMatrix, [
      "experimental backends must prove parity before becoming defaults",
  ]],
  ["TOP_TIER_ROADMAP", roadmap, [
    "Stage 4: Compiler Platform Closure",
    "preserve the current `oxc` and `rolldown` defaults",
  ]],
  ["COMPILER_EXECUTION_BACKLOG", compilerBacklog, [
    "oxc",
    "backend parity",
  ]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) {
      throw new Error(`${label} missing token: ${token}`)
    }
  }
}

console.log("compiler:canary OK")
