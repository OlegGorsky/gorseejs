#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const plan = readFileSync(join(repoRoot, "docs/BACKEND_CANDIDATE_ROLLOUT_PLAN.md"), "utf-8")

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message)
}

const candidateEvidence = packageJson.scripts?.["backend:candidate:evidence:verify"]
if (!candidateEvidence) throw new Error("missing backend:candidate:evidence:verify script")
for (const token of [
  "compiler:evidence:verify",
  "build:evidence:verify",
  "backend-candidate-evidence-check.mjs",
  "backend-default-switch-review-check.mjs",
  "backend-switch-evidence-check.mjs",
]) {
  assertIncludes(candidateEvidence, token, `backend:candidate:evidence:verify script missing token: ${token}`)
}

const candidateVerify = packageJson.scripts?.["backend:candidate:verify"]
if (!candidateVerify) throw new Error("missing backend:candidate:verify script")
for (const token of [
  "backend:candidate:evidence:verify",
  "release-train-check.mjs",
  "release-checklist-check.mjs",
  "ci-policy-check.mjs",
]) {
  assertIncludes(candidateVerify, token, `backend:candidate:verify script missing token: ${token}`)
}
for (const token of [
  "Phase 1: Candidate Verification",
  "bun run backend:candidate:evidence:verify",
  "bun run backend:candidate:verify",
  "Phase 2: Candidate Release Train",
  "Phase 3: Go / No-Go Review",
  "Phase 4: Default Switch",
  "Rollback Rule",
]) {
  assertIncludes(plan, token, `Backend candidate rollout plan missing token: ${token}`)
}
console.log("backend:candidate:rollout OK")
