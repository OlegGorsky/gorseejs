#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const ciWorkflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf-8")
const releaseWorkflow = readFileSync(join(repoRoot, ".github/workflows/release-train.yml"), "utf-8")
const ciPolicyDoc = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")

const packageManager = packageJson.packageManager
if (packageManager !== "bun@1.3.9") {
  throw new Error(`CI policy requires exact packageManager bun@1.3.9, received ${packageManager}`)
}

for (const token of [
  "bun install --frozen-lockfile",
  "bun run product:policy",
  "bun run dependency:policy",
  "bun run deploy:policy",
  "bun run api:policy",
  "bun run adoption:policy",
  "bun run ai:policy",
  "bun run dx:policy",
  "bun run maturity:policy",
  "bun run runtime:policy",
  "bun run runtime:security:policy",
  "bun run benchmarks:policy",
  "bun run examples:policy",
  "bun run critical:surface",
  "bun run ci:policy",
  "bun run compiler:promotion:check",
  "bun run build:promotion:check",
  "bun run backend:switch:evidence:check",
  "bun run backend:default-switch:review:check",
  "bun run backend:candidate:rollout:check",
  "bun run compiler:default:rehearsal:check",
  "bun run build:default:rehearsal:check",
  "bun run verify:security",
  "bun run test:critical-surface",
  "bun run test:confidence",
  "bun test",
  "bun run test:provider-smoke",
  "bun run test:browser-smoke",
  "ubuntu-latest",
  "macos-latest",
  "windows-latest",
  "node-version: [22, 24]",
  "chromium",
  "firefox",
  "webkit",
  "bun run release:train:check",
  "bun run release:checklist:check",
  "npm run release:check",
  "npm run install:matrix",
  "npm run release:smoke",
]) {
  if (!ciWorkflow.includes(token) && !releaseWorkflow.includes(token)) {
    throw new Error(`workflow policy missing token: ${token}`)
  }
}

for (const token of [
  "oven-sh/setup-bun@v2",
  "actions/setup-node@v4",
  "bun-version: 1.3.9",
  "workflow_dispatch",
  "stable",
  "canary",
  "rc",
]) {
  if (!ciWorkflow.includes(token) && !releaseWorkflow.includes(token)) {
    throw new Error(`workflow policy missing Bun/channel token: ${token}`)
  }
}

for (const section of [
  "Required Gates",
  "Change-Sensitive Rules",
  "Dependency Surface",
  "Deploy Surface",
  "API Stability Surface",
  "Adoption Proof Surface",
  "AI Workflow Surface",
  "DX Surface",
  "Maturity Surface",
  "Runtime Diagnostics Surface",
  "Runtime Security Surface",
  "Critical Surface Suite",
  "Runtime Smoke",
  "Support Matrix",
  "Release Train",
  "Bun Contract",
  "Product Standard",
]) {
  if (!ciPolicyDoc.includes(section)) {
    throw new Error(`CI policy doc missing section: ${section}`)
  }
}

console.log(`ci:policy OK (${packageJson.version})`)
