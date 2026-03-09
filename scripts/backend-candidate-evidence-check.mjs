#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const plan = readFileSync(join(repoRoot, "docs/BACKEND_CANDIDATE_EVIDENCE_PLAN.md"), "utf-8")
const review = readFileSync(join(repoRoot, "docs/BACKEND_DEFAULT_SWITCH_REVIEW.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

const evidenceScript = packageJson.scripts?.["backend:candidate:evidence:verify"]
if (!evidenceScript) throw new Error("missing backend:candidate:evidence:verify script")
for (const token of [
  "bun run compiler:evidence:verify",
  "bun run build:evidence:verify",
  "scripts/backend-candidate-evidence-check.mjs",
  "scripts/backend-default-switch-review-check.mjs",
  "scripts/backend-switch-evidence-check.mjs",
]) {
  assertIncludes(evidenceScript, token, `backend:candidate:evidence:verify script missing token: ${token}`)
}

const verifyScript = packageJson.scripts?.["backend:candidate:verify"]
if (!verifyScript) throw new Error("missing backend:candidate:verify script")
for (const token of [
  "backend:candidate:evidence:verify",
  "scripts/release-train-check.mjs",
  "scripts/release-checklist-check.mjs",
  "scripts/ci-policy-check.mjs",
]) {
  assertIncludes(verifyScript, token, `backend:candidate:verify script missing token: ${token}`)
}

for (const token of [
  "Run `bun run backend:candidate:evidence:verify` as the canonical unified evidence train.",
  "compiler evidence remains green",
  "build evidence remains green",
  "Run `bun run backend:candidate:verify` as the full candidate verification train.",
  "repeated green `backend:candidate:evidence:verify` runs",
  "repeated green `backend:candidate:verify` runs",
]) {
  assertIncludes(plan, token, `backend candidate evidence plan missing token: ${token}`)
}

for (const token of [
  "compiler default switch: go",
  "build default switch: go",
  "unified release decision: go",
]) {
  assertIncludes(review, token, `backend review missing token: ${token}`)
}

console.log("backend:candidate:evidence OK")
