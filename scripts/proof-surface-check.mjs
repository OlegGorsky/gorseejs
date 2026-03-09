import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const catalog = JSON.parse(readFileSync(join(repoRoot, "proof/proof-catalog.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const examplesReadme = readFileSync(join(repoRoot, "examples/README.md"), "utf-8")
const migrationGuide = readFileSync(join(repoRoot, "docs/MIGRATION_GUIDE.md"), "utf-8")
const rolloutGuide = readFileSync(join(repoRoot, "docs/FIRST_PRODUCTION_ROLLOUT.md"), "utf-8")
const proofDoc = readFileSync(join(repoRoot, "docs/MARKET_READY_PROOF.md"), "utf-8")

if (catalog.schemaVersion !== 1) {
  throw new Error(`proof catalog schemaVersion must be 1, received ${String(catalog.schemaVersion)}`)
}

if (!Array.isArray(catalog.surfaces) || catalog.surfaces.length < 5) {
  throw new Error("proof catalog must contain at least five proof surfaces")
}

const requiredProofClasses = [
  "full-saas",
  "docs-and-content",
  "ops-and-observability",
  "reference-app",
  "workspace-adoption",
]

for (const proofClass of requiredProofClasses) {
  if (!catalog.surfaces.some((surface) => surface.proofClass === proofClass)) {
    throw new Error(`proof catalog missing proofClass=${proofClass}`)
  }
}

for (const surface of catalog.surfaces) {
  for (const field of ["id", "kind", "path", "proofClass", "validates"]) {
    if (!(field in surface)) {
      throw new Error(`proof catalog surface missing field: ${field}`)
    }
  }
  if (!Array.isArray(surface.validates) || surface.validates.length === 0) {
    throw new Error(`proof surface ${surface.id} must declare non-empty validates[]`)
  }
  statSync(join(repoRoot, surface.path))
}

for (const token of [
  "Market-Ready Proof",
  "proof/proof-catalog.json",
  "examples/secure-saas",
  "benchmarks/realworld",
]) {
  if (!proofDoc.includes(token)) {
    throw new Error(`market-ready proof doc missing token: ${token}`)
  }
}

for (const token of [
  "Market-Ready Proof",
  "Migration Guide",
  "First Production Rollout",
]) {
  if (!readme.includes(token)) {
    throw new Error(`README missing proof/adoption token: ${token}`)
  }
}

for (const token of [
  "proof/proof-catalog.json",
  "benchmarks/realworld",
  "agent-aware-ops",
]) {
  if (!examplesReadme.includes(token)) {
    throw new Error(`examples README missing proof token: ${token}`)
  }
}

for (const token of [
  "Next.js",
  "Remix",
  "Astro",
  "Nuxt",
  "gorsee upgrade --rewrite-imports --check --report",
]) {
  if (!migrationGuide.includes(token)) {
    throw new Error(`migration guide missing adoption token: ${token}`)
  }
}

for (const token of [
  "proof catalog",
  "benchmarks/realworld",
  "secure-saas",
]) {
  if (!rolloutGuide.includes(token)) {
    throw new Error(`rollout guide missing proof token: ${token}`)
  }
}

console.log("proof:surface:check OK")
