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
const nodeNpmAdoption = readFileSync(join(repoRoot, "docs/NODE_NPM_ADOPTION.md"), "utf-8")
const thirdPartyEditors = readFileSync(join(repoRoot, "docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md"), "utf-8")
const reactiveEvidenceSummary = readFileSync(join(repoRoot, "docs/REACTIVE_EVIDENCE_SUMMARY.md"), "utf-8")
const reactiveEvidenceSummaryJson = JSON.parse(readFileSync(join(repoRoot, "docs/REACTIVE_EVIDENCE_SUMMARY.json"), "utf-8"))
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
  for (const field of ["id", "status", "deliverables", "closureSurface"]) {
    if (!(field in gap)) {
      throw new Error(`competition backlog gap missing field: ${field}`)
    }
  }
  if (!["open", "closed"].includes(gap.status)) {
    throw new Error(`competition backlog gap ${gap.id} must declare status=open|closed`)
  }
  if (!Array.isArray(gap.deliverables) || gap.deliverables.length === 0) {
    throw new Error(`competition backlog gap ${gap.id} must declare non-empty deliverables[]`)
  }
  if (!Array.isArray(gap.closureSurface) || gap.closureSurface.length === 0) {
    throw new Error(`competition backlog gap ${gap.id} must declare non-empty closureSurface[]`)
  }
}

for (const token of [
  "Machine-readable companion: `docs/COMPETITION_BACKLOG.json`",
  "Closed Competition Enablers",
  "External Proof",
  "Adoption Funnel",
  "Release-Facing Reactive Evidence Summary",
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
  "third-party editor integration contract",
  "release-facing reactive evidence summary",
  "docs/NODE_NPM_ADOPTION.md",
  "docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md",
  "docs/REACTIVE_EVIDENCE_SUMMARY.md",
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
  "Node and npm Adoption",
  "Third-Party Editor Integrations",
  "Reactive Evidence Summary",
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
  "docs/NODE_NPM_ADOPTION.md",
  "docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md",
  "docs/REACTIVE_EVIDENCE_SUMMARY.md",
  "docs/REACTIVE_EVIDENCE_SUMMARY.json",
]) {
  if (!agentsDoc.includes(token)) {
    throw new Error(`AGENTS missing competition token: ${token}`)
  }
}

for (const token of [
  "Validated Adoption Paths",
  "Node production runtime",
  "npm and `npx` are validated bootstrap and packed-install paths",
]) {
  if (!nodeNpmAdoption.includes(token)) {
    throw new Error(`Node/npm adoption doc missing token: ${token}`)
  }
}

for (const token of [
  "Stable Local Inputs",
  "VS Code and Cursor",
  "JetBrains IDEs",
  "Neovim and LSP-style Tooling",
  "MCP-Capable Tools",
]) {
  if (!thirdPartyEditors.includes(token)) {
    throw new Error(`third-party editor integrations doc missing token: ${token}`)
  }
}

for (const token of [
  "Machine-readable companion: `docs/REACTIVE_EVIDENCE_SUMMARY.json`",
  "Current Promoted Metrics",
  "Scope Boundary",
  "docs/REACTIVE_MEASUREMENT_GAPS.md",
]) {
  if (!reactiveEvidenceSummary.includes(token)) {
    throw new Error(`reactive evidence summary doc missing token: ${token}`)
  }
}

if (reactiveEvidenceSummaryJson.version !== 1 || reactiveEvidenceSummaryJson.kind !== "gorsee.reactive-evidence-summary") {
  throw new Error("reactive evidence summary json must stay on schema version 1")
}

if (!Array.isArray(reactiveEvidenceSummaryJson.metrics) || reactiveEvidenceSummaryJson.metrics.length < 5) {
  throw new Error("reactive evidence summary json must expose at least five promoted metrics")
}

for (const metric of reactiveEvidenceSummaryJson.metrics) {
  for (const field of ["id", "measured", "regressionMax", "headroom", "status"]) {
    if (!(field in metric)) {
      throw new Error(`reactive evidence summary metric missing field: ${field}`)
    }
  }
  if (metric.status !== "within-threshold") {
    throw new Error(`reactive evidence summary metric ${metric.id} must remain within-threshold`)
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
