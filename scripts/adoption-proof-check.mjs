import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const proofCatalog = JSON.parse(readFileSync(join(repoRoot, "proof/proof-catalog.json"), "utf-8"))
const manifest = JSON.parse(readFileSync(join(repoRoot, "docs/ADOPTION_PROOF_MANIFEST.json"), "utf-8"))
const proofDoc = readFileSync(join(repoRoot, "docs/MARKET_READY_PROOF.md"), "utf-8")
const migrationGuide = readFileSync(join(repoRoot, "docs/MIGRATION_GUIDE.md"), "utf-8")
const rolloutGuide = readFileSync(join(repoRoot, "docs/FIRST_PRODUCTION_ROLLOUT.md"), "utf-8")
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")

if (!packageJson.scripts?.["adoption:policy"]?.includes("adoption-proof-check.mjs")) {
  throw new Error("missing adoption:policy script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run adoption:policy")) {
  throw new Error("verify:security must run adoption:policy")
}

if (manifest.version !== 1) {
  throw new Error(`ADOPTION_PROOF_MANIFEST version must be 1, received ${String(manifest.version)}`)
}

if (!Array.isArray(manifest.appShapes) || manifest.appShapes.length < 7) {
  throw new Error("ADOPTION_PROOF_MANIFEST must contain at least seven appShapes")
}

const catalogById = new Map(proofCatalog.surfaces.map((surface) => [surface.id, surface]))
for (const shape of manifest.appShapes) {
  for (const field of ["id", "proofSurfaceId", "primaryPath", "rolloutGuide", "migrationGuide", "validates"]) {
    if (!(field in shape)) {
      throw new Error(`adoption proof shape missing field: ${field}`)
    }
  }
  if (!Array.isArray(shape.validates) || shape.validates.length === 0) {
    throw new Error(`adoption proof shape ${shape.id} must declare non-empty validates[]`)
  }
  statSync(join(repoRoot, shape.primaryPath))
  statSync(join(repoRoot, shape.rolloutGuide))
  statSync(join(repoRoot, shape.migrationGuide))
  const surface = catalogById.get(shape.proofSurfaceId)
  if (!surface) {
    throw new Error(`adoption proof shape ${shape.id} references missing proof surface ${shape.proofSurfaceId}`)
  }
  if (surface.path !== shape.primaryPath) {
    throw new Error(`adoption proof path drift for ${shape.id}: expected ${surface.path}, received ${shape.primaryPath}`)
  }
}

for (const token of [
  "docs/ADOPTION_PROOF_MANIFEST.json",
  "proof/proof-catalog.json",
  "examples/frontend-app",
  "examples/secure-saas",
  "benchmarks/realworld",
  "examples/workspace-monorepo",
  "examples/server-api",
]) {
  if (!proofDoc.includes(token)) {
    throw new Error(`market-ready proof doc missing adoption token: ${token}`)
  }
}

for (const token of [
  "docs/ADOPTION_PROOF_MANIFEST.json",
  "proof/proof-catalog.json",
  "examples/frontend-app",
  "examples/secure-saas",
  "examples/content-site",
  "examples/agent-aware-ops",
  "benchmarks/realworld",
  "examples/server-api",
]) {
  if (!rolloutGuide.includes(token)) {
    throw new Error(`rollout guide missing adoption token: ${token}`)
  }
}

for (const token of [
  "docs/ADOPTION_PROOF_MANIFEST.json",
  "proof/proof-catalog.json",
  "examples/frontend-app",
  "examples/secure-saas",
  "examples/content-site",
  "examples/agent-aware-ops",
  "benchmarks/realworld",
  "examples/workspace-monorepo",
  "examples/server-api",
]) {
  if (!migrationGuide.includes(token)) {
    throw new Error(`migration guide missing adoption token: ${token}`)
  }
}

for (const token of [
  "adoption:policy",
  "docs/ADOPTION_PROOF_MANIFEST.json",
]) {
  if (!supportMatrix.includes(token)) {
    throw new Error(`support matrix missing adoption token: ${token}`)
  }
  if (!readme.includes(token)) {
    throw new Error(`README missing adoption token: ${token}`)
  }
}

console.log("adoption:policy OK")
