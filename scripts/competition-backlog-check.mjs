import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const backlog = JSON.parse(readFileSync(join(repoRoot, "docs/COMPETITION_BACKLOG.json"), "utf-8"))
const closurePlan = readFileSync(join(repoRoot, "docs/COMPETITION_CLOSURE_PLAN.md"), "utf-8")
const competitionPlan = readFileSync(join(repoRoot, "docs/TOP_TIER_COMPETITION_PLAN.md"), "utf-8")
const productSurfaceAudit = readFileSync(join(repoRoot, "docs/PRODUCT_SURFACE_AUDIT.md"), "utf-8")
const externalProofIntake = readFileSync(join(repoRoot, "docs/EXTERNAL_PROOF_INTAKE.md"), "utf-8")
const externalProofPipeline = JSON.parse(readFileSync(join(repoRoot, "docs/EXTERNAL_PROOF_PIPELINE.json"), "utf-8"))
const externalProofReview = readFileSync(join(repoRoot, "docs/EXTERNAL_PROOF_REVIEW.md"), "utf-8")
const externalProofRegistry = JSON.parse(readFileSync(join(repoRoot, "docs/EXTERNAL_PROOF_REGISTRY.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const agentsDoc = readFileSync(join(repoRoot, "AGENTS.md"), "utf-8")

if (!packageJson.scripts?.["competition:policy"]?.includes("competition-backlog-check.mjs")) {
  throw new Error("missing competition:policy script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run competition:policy")) {
  throw new Error("verify:security must run competition:policy")
}

if (backlog.version !== 1) {
  throw new Error(`COMPETITION_BACKLOG version must be 1, received ${String(backlog.version)}`)
}

if (externalProofRegistry.version !== 1) {
  throw new Error(`EXTERNAL_PROOF_REGISTRY version must be 1, received ${String(externalProofRegistry.version)}`)
}

if (externalProofPipeline.version !== 1) {
  throw new Error(`EXTERNAL_PROOF_PIPELINE version must be 1, received ${String(externalProofPipeline.version)}`)
}

if (!Array.isArray(backlog.remainingExternalGaps) || backlog.remainingExternalGaps.length < 4) {
  throw new Error("COMPETITION_BACKLOG must contain at least four remainingExternalGaps")
}

for (const gap of backlog.remainingExternalGaps) {
  for (const field of ["id", "status", "deliverables"]) {
    if (!(field in gap)) {
      throw new Error(`competition backlog gap missing field: ${field}`)
    }
  }
  if (gap.status !== "open") {
    throw new Error(`competition backlog gap ${gap.id} must stay open until externally closed`)
  }
  if (!Array.isArray(gap.deliverables) || gap.deliverables.length === 0) {
    throw new Error(`competition backlog gap ${gap.id} must declare non-empty deliverables[]`)
  }
}

for (const token of [
  "Machine-readable companion: `docs/COMPETITION_BACKLOG.json`",
  "External Proof",
  "Adoption Funnel",
  "Comparative Reactive Evidence",
  "Editor Ecosystem Reach",
]) {
  if (!closurePlan.includes(token)) {
    throw new Error(`competition closure plan missing token: ${token}`)
  }
}

for (const token of [
  "docs/EXTERNAL_PROOF_PIPELINE.json",
  "docs/EXTERNAL_PROOF_REVIEW.md",
  "docs/EXTERNAL_PROOF_REGISTRY.json",
  "Public Migration Case Study",
  "External Reference Deployment",
  "docs/templates/EXTERNAL_MIGRATION_CASE_STUDY.md",
  "docs/templates/EXTERNAL_REFERENCE_PROFILE.md",
]) {
  if (!externalProofIntake.includes(token)) {
    throw new Error(`external proof intake missing token: ${token}`)
  }
}

for (const token of [
  "pending",
  "verified",
  "accepted",
  "rejected",
  "docs/EXTERNAL_PROOF_PIPELINE.json",
  "docs/EXTERNAL_PROOF_REGISTRY.json",
]) {
  if (!externalProofReview.includes(token)) {
    throw new Error(`external proof review missing token: ${token}`)
  }
}

for (const token of [
  "External Proof Gap",
  "Adoption Funnel Gap",
  "Comparative Performance Gap",
  "Ecosystem Reach Gap",
]) {
  if (!competitionPlan.includes(token)) {
    throw new Error(`top-tier competition plan missing token: ${token}`)
  }
}

for (const token of [
  "market-facing adoption proof",
  "broader editor and AI ecosystem reach",
  "docs/COMPETITION_CLOSURE_PLAN.md",
  "docs/COMPETITION_BACKLOG.json",
  "docs/EXTERNAL_PROOF_INTAKE.md",
  "docs/EXTERNAL_PROOF_PIPELINE.json",
  "docs/EXTERNAL_PROOF_REVIEW.md",
  "docs/EXTERNAL_PROOF_REGISTRY.json",
]) {
  if (!productSurfaceAudit.includes(token)) {
    throw new Error(`product surface audit missing competition token: ${token}`)
  }
}

for (const token of [
  "Competition Closure Plan",
  "Competition Backlog",
  "External Proof Intake",
  "External Proof Pipeline",
  "External Proof Review",
  "External Proof Registry",
]) {
  if (!readme.includes(token)) {
    throw new Error(`README missing competition token: ${token}`)
  }
}

for (const token of [
  "docs/COMPETITION_CLOSURE_PLAN.md",
  "docs/COMPETITION_BACKLOG.json",
  "docs/EXTERNAL_PROOF_INTAKE.md",
  "docs/EXTERNAL_PROOF_PIPELINE.json",
  "docs/EXTERNAL_PROOF_REVIEW.md",
  "docs/EXTERNAL_PROOF_REGISTRY.json",
]) {
  if (!agentsDoc.includes(token)) {
    throw new Error(`AGENTS missing competition token: ${token}`)
  }
}

if (!Array.isArray(externalProofRegistry.migrationCaseStudies) || !Array.isArray(externalProofRegistry.externalReferences)) {
  throw new Error("EXTERNAL_PROOF_REGISTRY must expose migrationCaseStudies[] and externalReferences[] arrays")
}

if (!Array.isArray(externalProofPipeline.pendingMigrationCaseStudies) || !Array.isArray(externalProofPipeline.pendingExternalReferences)) {
  throw new Error("EXTERNAL_PROOF_PIPELINE must expose pendingMigrationCaseStudies[] and pendingExternalReferences[] arrays")
}

validateEntrySet(
  externalProofPipeline.pendingMigrationCaseStudies,
  externalProofPipeline.pendingSchemas?.migrationCaseStudy,
  "pending migration case study",
)
validateEntrySet(
  externalProofPipeline.pendingExternalReferences,
  externalProofPipeline.pendingSchemas?.externalReference,
  "pending external reference",
)
validateEntrySet(
  externalProofRegistry.migrationCaseStudies,
  externalProofRegistry.acceptedSchemas?.migrationCaseStudy,
  "accepted migration case study",
)
validateEntrySet(
  externalProofRegistry.externalReferences,
  externalProofRegistry.acceptedSchemas?.externalReference,
  "accepted external reference",
)

assertNoIdCollisions(
  [...externalProofPipeline.pendingMigrationCaseStudies, ...externalProofPipeline.pendingExternalReferences],
  [...externalProofRegistry.migrationCaseStudies, ...externalProofRegistry.externalReferences],
)

console.log("competition:policy OK")

function validateEntrySet(entries, schema, label) {
  if (!Array.isArray(schema) || schema.length === 0) {
    throw new Error(`${label} schema must be a non-empty array`)
  }
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      throw new Error(`${label} entry must be an object`)
    }
    for (const field of schema) {
      if (!(field in entry)) {
        throw new Error(`${label} missing field: ${field}`)
      }
    }
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      throw new Error(`${label} id must be a non-empty string`)
    }
    if (!Array.isArray(entry.validatedClaims) || entry.validatedClaims.length === 0) {
      throw new Error(`${label} ${entry.id} must declare non-empty validatedClaims[]`)
    }
  }
}

function assertNoIdCollisions(pendingEntries, acceptedEntries) {
  const acceptedIds = new Set(acceptedEntries.map((entry) => entry?.id).filter((id) => typeof id === "string"))
  for (const entry of pendingEntries) {
    if (acceptedIds.has(entry?.id)) {
      throw new Error(`external proof id collision between pending and accepted entries: ${entry.id}`)
    }
  }
}
