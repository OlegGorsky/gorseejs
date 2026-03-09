#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const agentsDoc = readFileSync(join(repoRoot, "AGENTS.md"), "utf-8")
const productVision = readFileSync(join(repoRoot, "docs/PRODUCT_VISION.md"), "utf-8")
const doctrineDoc = readFileSync(join(repoRoot, "docs/FRAMEWORK_DOCTRINE.md"), "utf-8")
const roadmapDoc = readFileSync(join(repoRoot, "docs/TOP_TIER_ROADMAP.md"), "utf-8")
const canonicalRecipesDoc = readFileSync(join(repoRoot, "docs/CANONICAL_RECIPES.md"), "utf-8")
const canonicalExamplesDoc = readFileSync(join(repoRoot, "examples/README.md"), "utf-8")
const examplesPolicyDoc = readFileSync(join(repoRoot, "docs/EXAMPLES_POLICY.md"), "utf-8")
const reactiveRuntimeDoc = readFileSync(join(repoRoot, "docs/REACTIVE_RUNTIME.md"), "utf-8")
const reactiveBenchmarksDoc = readFileSync(join(repoRoot, "docs/REACTIVE_BENCHMARKS.md"), "utf-8")
const reactivePatternsDoc = readFileSync(join(repoRoot, "docs/REACTIVE_PATTERNS.md"), "utf-8")
const reactiveHydrationDoc = readFileSync(join(repoRoot, "docs/REACTIVE_HYDRATION.md"), "utf-8")
const reactiveDebuggingDoc = readFileSync(join(repoRoot, "docs/REACTIVE_DEBUGGING.md"), "utf-8")
const reactiveMeasurementGapsDoc = readFileSync(join(repoRoot, "docs/REACTIVE_MEASUREMENT_GAPS.md"), "utf-8")
const benchmarkPolicyDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_POLICY.md"), "utf-8")
const benchmarkMethodologyDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_METHODOLOGY.md"), "utf-8")
const ssrBenchmarkProofDoc = readFileSync(join(repoRoot, "docs/SSR_BENCHMARK_PROOF.md"), "utf-8")
const domBenchmarkProofDoc = readFileSync(join(repoRoot, "docs/DOM_BENCHMARK_PROOF.md"), "utf-8")
const benchmarkArtifactsDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_ARTIFACTS.md"), "utf-8")
const benchmarkReleaseDisciplineDoc = readFileSync(join(repoRoot, "docs/BENCHMARK_RELEASE_DISCIPLINE.md"), "utf-8")
const buildDiagnosticsDoc = readFileSync(join(repoRoot, "docs/BUILD_DIAGNOSTICS.md"), "utf-8")
const runtimeFailuresDoc = readFileSync(join(repoRoot, "docs/RUNTIME_FAILURES.md"), "utf-8")
const cacheInvalidationDoc = readFileSync(join(repoRoot, "docs/CACHE_INVALIDATION.md"), "utf-8")
const streamingHydrationFailuresDoc = readFileSync(join(repoRoot, "docs/STREAMING_HYDRATION_FAILURES.md"), "utf-8")
const runtimeTriageDoc = readFileSync(join(repoRoot, "docs/RUNTIME_TRIAGE.md"), "utf-8")
const starterFailuresDoc = readFileSync(join(repoRoot, "docs/STARTER_FAILURES.md"), "utf-8")
const aiWorkflowsDoc = readFileSync(join(repoRoot, "docs/AI_WORKFLOWS.md"), "utf-8")
const aiIdeSyncWorkflowDoc = readFileSync(join(repoRoot, "docs/AI_IDE_SYNC_WORKFLOW.md"), "utf-8")
const aiMcpWorkflowDoc = readFileSync(join(repoRoot, "docs/AI_MCP_WORKFLOW.md"), "utf-8")
const aiBridgeWorkflowDoc = readFileSync(join(repoRoot, "docs/AI_BRIDGE_WORKFLOW.md"), "utf-8")
const aiToolBuildersDoc = readFileSync(join(repoRoot, "docs/AI_TOOL_BUILDERS.md"), "utf-8")
const aiSurfaceStabilityDoc = readFileSync(join(repoRoot, "docs/AI_SURFACE_STABILITY.md"), "utf-8")
const aiSessionPacksDoc = readFileSync(join(repoRoot, "docs/AI_SESSION_PACKS.md"), "utf-8")
const aiDebuggingWorkflowsDoc = readFileSync(join(repoRoot, "docs/AI_DEBUGGING_WORKFLOWS.md"), "utf-8")
const starterOnboardingDoc = readFileSync(join(repoRoot, "docs/STARTER_ONBOARDING.md"), "utf-8")
const migrationGuideDoc = readFileSync(join(repoRoot, "docs/MIGRATION_GUIDE.md"), "utf-8")
const upgradePlaybookDoc = readFileSync(join(repoRoot, "docs/UPGRADE_PLAYBOOK.md"), "utf-8")
const deployTargetGuideDoc = readFileSync(join(repoRoot, "docs/DEPLOY_TARGET_GUIDE.md"), "utf-8")
const firstProductionRolloutDoc = readFileSync(join(repoRoot, "docs/FIRST_PRODUCTION_ROLLOUT.md"), "utf-8")
const authCacheDataPathsDoc = readFileSync(join(repoRoot, "docs/AUTH_CACHE_DATA_PATHS.md"), "utf-8")
const recipeBoundariesDoc = readFileSync(join(repoRoot, "docs/RECIPE_BOUNDARIES.md"), "utf-8")
const workspaceAdoptionDoc = readFileSync(join(repoRoot, "docs/WORKSPACE_ADOPTION.md"), "utf-8")
const teamFailuresDoc = readFileSync(join(repoRoot, "docs/TEAM_FAILURES.md"), "utf-8")
const maturityPolicyDoc = readFileSync(join(repoRoot, "docs/MATURITY_POLICY.md"), "utf-8")
const dependencyPolicyDoc = readFileSync(join(repoRoot, "docs/DEPENDENCY_POLICY.md"), "utf-8")
const compatibilityGuardrailsDoc = readFileSync(join(repoRoot, "docs/COMPATIBILITY_GUARDRAILS.md"), "utf-8")
const ambiguityPolicyDoc = readFileSync(join(repoRoot, "docs/AMBIGUITY_POLICY.md"), "utf-8")
const dxFeedbackLoopDoc = readFileSync(join(repoRoot, "docs/DX_FEEDBACK_LOOP.md"), "utf-8")
const evidencePolicyDoc = readFileSync(join(repoRoot, "docs/EVIDENCE_POLICY.md"), "utf-8")
const roadmapCompletionPolicyDoc = readFileSync(join(repoRoot, "docs/ROADMAP_COMPLETION_POLICY.md"), "utf-8")
const apiStabilityDoc = readFileSync(join(repoRoot, "docs/API_STABILITY.md"), "utf-8")
const aiArtifactContractDoc = readFileSync(join(repoRoot, "docs/AI_ARTIFACT_CONTRACT.md"), "utf-8")
const supportMatrixDoc = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const deprecationPolicyDoc = readFileSync(join(repoRoot, "docs/DEPRECATION_POLICY.md"), "utf-8")
const aiContracts = readFileSync(join(repoRoot, "src/ai/contracts.ts"), "utf-8")

const schemaMatch = aiContracts.match(/GORSEE_AI_CONTEXT_SCHEMA_VERSION\s*=\s*"([^"]+)"/)
if (!schemaMatch) {
  throw new Error("unable to resolve GORSEE_AI_CONTEXT_SCHEMA_VERSION from src/ai/contracts.ts")
}
const schemaVersion = schemaMatch[1]

const requiredScripts = [
  "product:policy",
  "ai:policy",
  "repo:policy",
  "ci:policy",
  "release:train:check",
  "release:checklist:check",
]

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`missing product policy script: ${scriptName}`)
  }
}

const expectedExports = {
  ".": "./src/index.ts",
  "./compat": "./src/compat.ts",
  "./client": "./src/client.ts",
  "./server": "./src/server-entry.ts",
}

for (const [key, expected] of Object.entries(expectedExports)) {
  if (packageJson.exports?.[key] !== expected) {
    throw new Error(`public export contract drift for ${key}: expected ${expected}, received ${packageJson.exports?.[key]}`)
  }
}

for (const doc of [
  [readme, "README.md"],
  [agentsDoc, "AGENTS.md"],
  [productVision, "docs/PRODUCT_VISION.md"],
  [doctrineDoc, "docs/FRAMEWORK_DOCTRINE.md"],
  [roadmapDoc, "docs/TOP_TIER_ROADMAP.md"],
  [canonicalRecipesDoc, "docs/CANONICAL_RECIPES.md"],
  [canonicalExamplesDoc, "examples/README.md"],
  [examplesPolicyDoc, "docs/EXAMPLES_POLICY.md"],
  [reactiveRuntimeDoc, "docs/REACTIVE_RUNTIME.md"],
  [reactiveBenchmarksDoc, "docs/REACTIVE_BENCHMARKS.md"],
  [reactivePatternsDoc, "docs/REACTIVE_PATTERNS.md"],
  [reactiveHydrationDoc, "docs/REACTIVE_HYDRATION.md"],
  [reactiveDebuggingDoc, "docs/REACTIVE_DEBUGGING.md"],
  [reactiveMeasurementGapsDoc, "docs/REACTIVE_MEASUREMENT_GAPS.md"],
  [benchmarkPolicyDoc, "docs/BENCHMARK_POLICY.md"],
  [benchmarkMethodologyDoc, "docs/BENCHMARK_METHODOLOGY.md"],
  [ssrBenchmarkProofDoc, "docs/SSR_BENCHMARK_PROOF.md"],
  [domBenchmarkProofDoc, "docs/DOM_BENCHMARK_PROOF.md"],
  [benchmarkArtifactsDoc, "docs/BENCHMARK_ARTIFACTS.md"],
  [benchmarkReleaseDisciplineDoc, "docs/BENCHMARK_RELEASE_DISCIPLINE.md"],
  [buildDiagnosticsDoc, "docs/BUILD_DIAGNOSTICS.md"],
  [runtimeFailuresDoc, "docs/RUNTIME_FAILURES.md"],
  [cacheInvalidationDoc, "docs/CACHE_INVALIDATION.md"],
  [streamingHydrationFailuresDoc, "docs/STREAMING_HYDRATION_FAILURES.md"],
  [runtimeTriageDoc, "docs/RUNTIME_TRIAGE.md"],
  [starterFailuresDoc, "docs/STARTER_FAILURES.md"],
  [aiWorkflowsDoc, "docs/AI_WORKFLOWS.md"],
  [aiIdeSyncWorkflowDoc, "docs/AI_IDE_SYNC_WORKFLOW.md"],
  [aiMcpWorkflowDoc, "docs/AI_MCP_WORKFLOW.md"],
  [aiBridgeWorkflowDoc, "docs/AI_BRIDGE_WORKFLOW.md"],
  [aiToolBuildersDoc, "docs/AI_TOOL_BUILDERS.md"],
  [aiSurfaceStabilityDoc, "docs/AI_SURFACE_STABILITY.md"],
  [aiSessionPacksDoc, "docs/AI_SESSION_PACKS.md"],
  [aiDebuggingWorkflowsDoc, "docs/AI_DEBUGGING_WORKFLOWS.md"],
  [starterOnboardingDoc, "docs/STARTER_ONBOARDING.md"],
  [migrationGuideDoc, "docs/MIGRATION_GUIDE.md"],
  [upgradePlaybookDoc, "docs/UPGRADE_PLAYBOOK.md"],
  [deployTargetGuideDoc, "docs/DEPLOY_TARGET_GUIDE.md"],
  [firstProductionRolloutDoc, "docs/FIRST_PRODUCTION_ROLLOUT.md"],
  [authCacheDataPathsDoc, "docs/AUTH_CACHE_DATA_PATHS.md"],
  [recipeBoundariesDoc, "docs/RECIPE_BOUNDARIES.md"],
  [workspaceAdoptionDoc, "docs/WORKSPACE_ADOPTION.md"],
  [teamFailuresDoc, "docs/TEAM_FAILURES.md"],
  [maturityPolicyDoc, "docs/MATURITY_POLICY.md"],
  [dependencyPolicyDoc, "docs/DEPENDENCY_POLICY.md"],
  [compatibilityGuardrailsDoc, "docs/COMPATIBILITY_GUARDRAILS.md"],
  [ambiguityPolicyDoc, "docs/AMBIGUITY_POLICY.md"],
  [dxFeedbackLoopDoc, "docs/DX_FEEDBACK_LOOP.md"],
  [evidencePolicyDoc, "docs/EVIDENCE_POLICY.md"],
  [roadmapCompletionPolicyDoc, "docs/ROADMAP_COMPLETION_POLICY.md"],
  [apiStabilityDoc, "docs/API_STABILITY.md"],
  [aiArtifactContractDoc, "docs/AI_ARTIFACT_CONTRACT.md"],
  [supportMatrixDoc, "docs/SUPPORT_MATRIX.md"],
  [deprecationPolicyDoc, "docs/DEPRECATION_POLICY.md"],
]) {
  const [source, label] = doc
  assertIncludes(source, "mature product", `${label} must describe Gorsee as a mature product`)
}

assertIncludes(readme, "AI-first reactive full-stack TypeScript framework", "README must describe the AI-first reactive product position")
assertIncludes(readme, "Top-Tier Roadmap", "README must link the top-tier roadmap")
assertIncludes(readme, "Canonical Recipes", "README must link canonical recipes")
assertIncludes(readme, "Canonical Examples", "README must link canonical examples")
assertIncludes(readme, "Examples Policy", "README should link examples policy when examples are product surface")
assertIncludes(readme, "Reactive Runtime", "README must link reactive runtime docs")
assertIncludes(readme, "Reactive Benchmarks", "README must link reactive benchmarks docs")
assertIncludes(readme, "Reactive Patterns", "README must link reactive patterns docs")
assertIncludes(readme, "Reactive Hydration", "README must link reactive hydration docs")
assertIncludes(readme, "Reactive Debugging", "README must link reactive debugging docs")
assertIncludes(readme, "Reactive Measurement Gaps", "README must link reactive measurement gaps docs")
assertIncludes(readme, "Benchmark Policy", "README must link benchmark policy docs")
assertIncludes(readme, "Benchmark Methodology", "README must link benchmark methodology docs")
assertIncludes(readme, "SSR Benchmark Proof", "README must link SSR benchmark proof docs")
assertIncludes(readme, "DOM Benchmark Proof", "README must link DOM benchmark proof docs")
assertIncludes(readme, "Benchmark Artifacts", "README must link benchmark artifacts docs")
assertIncludes(readme, "Benchmark Release Discipline", "README must link benchmark release discipline docs")
assertIncludes(readme, "Build Diagnostics", "README must link build diagnostics docs")
assertIncludes(readme, "Runtime Failures", "README must link runtime failures docs")
assertIncludes(readme, "Cache Invalidation", "README must link cache invalidation docs")
assertIncludes(readme, "Streaming and Hydration Failures", "README must link streaming and hydration failure docs")
assertIncludes(readme, "Runtime Triage", "README must link runtime triage docs")
assertIncludes(readme, "Starter Failures", "README must link starter failure docs")
assertIncludes(readme, "AI Workflows", "README must link AI workflows docs")
assertIncludes(readme, "AI IDE Sync Workflow", "README must link AI IDE sync workflow docs")
assertIncludes(readme, "AI MCP Workflow", "README must link AI MCP workflow docs")
assertIncludes(readme, "AI Bridge Workflow", "README must link AI bridge workflow docs")
assertIncludes(readme, "AI Tool Builders", "README must link AI tool builders docs")
assertIncludes(readme, "AI Surface Stability", "README must link AI surface stability docs")
assertIncludes(readme, "AI Session Packs", "README must link AI session packs docs")
assertIncludes(readme, "AI Debugging Workflows", "README must link AI debugging workflows docs")
assertIncludes(readme, "Starter Onboarding", "README must link starter onboarding docs")
assertIncludes(readme, "Migration Guide", "README must link migration guide docs")
assertIncludes(readme, "Upgrade Playbook", "README must link upgrade playbook docs")
assertIncludes(readme, "Deploy Target Guide", "README must link deploy target guide docs")
assertIncludes(readme, "First Production Rollout", "README must link first production rollout docs")
assertIncludes(readme, "Auth / Cache / Data Paths", "README must link auth/cache/data docs")
assertIncludes(readme, "Recipe Boundaries", "README must link recipe boundaries docs")
assertIncludes(readme, "Workspace Adoption", "README must link workspace adoption docs")
assertIncludes(readme, "Team Failures", "README must link team failures docs")
assertIncludes(readme, "Maturity Policy", "README must link maturity policy docs")
assertIncludes(readme, "Dependency Policy", "README must link dependency policy docs")
assertIncludes(readme, "Compatibility Guardrails", "README must link compatibility guardrails docs")
assertIncludes(readme, "Ambiguity Policy", "README must link ambiguity policy docs")
assertIncludes(readme, "DX Feedback Loop", "README must link DX feedback loop docs")
assertIncludes(readme, "Evidence Policy", "README must link evidence policy docs")
assertIncludes(readme, "Roadmap Completion Policy", "README must link roadmap completion policy docs")
assertIncludes(readme, "API Stability Policy", "README must link API stability policy")
assertIncludes(readme, "AI Artifact Contract", "README must link AI artifact contract")
assertIncludes(readme, "Support Matrix", "README must link support matrix")
assertIncludes(readme, "Deprecation Policy", "README must link deprecation policy")
for (const token of [
  "single canonical execution plan",
  "Stage 1: Navigation / Hydration Hardening",
  "Stage 2: Reactive Diagnostics / Devtools",
  "Stage 3: Wider CI / Support Matrix",
  "Stage 4: Compiler Platform Closure",
  "Stage 5: Fixture-App / Adapter / Plugin Conformance",
  "Stage 6: Performance Evidence on Realistic Apps",
]) {
  assertIncludes(roadmapDoc, token, `Top-tier roadmap missing token: ${token}`)
}

assertIncludes(agentsDoc, "Gorsee is an AI-first reactive full-stack framework.", "AGENTS.md must preserve project identity")
assertIncludes(agentsDoc, "It is a mature product.", "AGENTS.md must preserve mature product standard")
assertIncludes(agentsDoc, "docs/API_STABILITY.md", "AGENTS.md must reference API stability policy")
assertIncludes(agentsDoc, "docs/AI_ARTIFACT_CONTRACT.md", "AGENTS.md must reference AI artifact contract")
assertIncludes(agentsDoc, "docs/AI_WORKFLOWS.md", "AGENTS.md must reference AI workflows")
assertIncludes(agentsDoc, "docs/AI_SURFACE_STABILITY.md", "AGENTS.md must reference AI surface stability")
assertIncludes(agentsDoc, "docs/MATURITY_POLICY.md", "AGENTS.md must reference maturity policy")
assertIncludes(agentsDoc, "docs/DEPENDENCY_POLICY.md", "AGENTS.md must reference dependency policy")

for (const token of [
  "Stable",
  "Compatibility",
  "Experimental",
  "Internal",
  "`gorsee/client` is stable and preferred",
  "`gorsee/server` is stable and preferred",
  "root `gorsee` is compatibility-only",
]) {
  assertIncludes(apiStabilityDoc, token, `API stability policy missing token: ${token}`)
}

for (const token of [
  "Experimental Backend Flags",
  "GORSEE_COMPILER_BACKEND=experimental-oxc",
  "GORSEE_BUILD_BACKEND=experimental-rolldown",
  "default production behavior remains `oxc` analysis plus `rolldown` build backend",
  "Backend Promotion Gates",
  "`oxc` is the canonical compiler default",
  "`rolldown` is the canonical build default",
]) {
  assertIncludes(supportMatrixDoc, token, `Support matrix missing backend migration token: ${token}`)
}

for (const token of [
  "schema version",
  "GORSEE_AI_CONTEXT_SCHEMA_VERSION",
  "Current schema:",
  "`.gorsee/ide/events.json`",
  "`.gorsee/ide/context.md`",
  "`.gorsee/agent/latest.json`",
  "`.gorsee/agent/latest.md`",
]) {
  assertIncludes(aiArtifactContractDoc, token, `AI artifact contract missing token: ${token}`)
}
assertIncludes(aiArtifactContractDoc, `- \`${schemaVersion}\``, "AI artifact contract must document the current schema version")
for (const token of [
  "request.error",
  "build.summary",
  "release.smoke.error",
]) {
  assertIncludes(aiArtifactContractDoc, token, `AI artifact contract missing runtime failure token: ${token}`)
}

for (const token of [
  "Secure SaaS App",
  "Content / Marketing Site",
  "Agent-Aware Internal Tool",
  "Workspace / Monorepo App",
  "recommended production paths",
]) {
  assertIncludes(canonicalRecipesDoc, token, `Canonical recipes doc missing token: ${token}`)
}

for (const token of [
  "Canonical Examples",
  "examples/secure-saas",
  "examples/content-site",
  "examples/workspace-monorepo",
  "product-grade reference apps",
]) {
  assertIncludes(canonicalExamplesDoc, token, `Canonical examples doc missing token: ${token}`)
}

for (const token of [
  "Examples Policy",
  "mature product surface",
  "examples/secure-saas",
  "examples/content-site",
  "examples/workspace-monorepo",
  "`bun run examples:policy`",
]) {
  assertIncludes(examplesPolicyDoc, token, `Examples policy doc missing token: ${token}`)
}

for (const token of [
  "Reactive Runtime",
  "fine-grained reactive model",
  "signals are the primary unit",
  "Use `gorsee/client` for the public reactive surface",
  "Non-Goals",
]) {
  assertIncludes(reactiveRuntimeDoc, token, `Reactive runtime doc missing token: ${token}`)
}

for (const token of [
  "Reactive Benchmarks",
  "`benchmarks/ssr-throughput`",
  "`benchmarks/js-framework-bench`",
  "Interpretation Rules",
  "Current Gaps",
]) {
  assertIncludes(reactiveBenchmarksDoc, token, `Reactive benchmarks doc missing token: ${token}`)
}

for (const token of [
  "Reactive Patterns",
  "createResource",
  "createMutation",
  "Suspense",
  "island()",
]) {
  assertIncludes(reactivePatternsDoc, token, `Reactive patterns doc missing token: ${token}`)
}

for (const token of [
  "Reactive Hydration",
  "Prefer the smallest hydration boundary",
  "SSR-only",
  "Islands",
  "Broad Route Hydration",
]) {
  assertIncludes(reactiveHydrationDoc, token, `Reactive hydration doc missing token: ${token}`)
}

for (const token of [
  "Reactive Debugging",
  "Current Gaps",
  "recomputation chains",
  "hydration ownership",
  "resource cache/invalidation state",
]) {
  assertIncludes(reactiveDebuggingDoc, token, `Reactive debugging doc missing token: ${token}`)
}

for (const token of [
  "Reactive Measurement Gaps",
  "Hydration",
  "Resources",
  "Mutations",
  "Multi-Island Pages",
]) {
  assertIncludes(reactiveMeasurementGapsDoc, token, `Reactive measurement gaps doc missing token: ${token}`)
}

for (const token of [
  "Benchmark Policy",
  "evidence, not decoration",
  "`benchmarks/ssr-throughput`",
  "`benchmarks/js-framework-bench`",
  "`benchmarks/realworld`",
]) {
  assertIncludes(benchmarkPolicyDoc, token, `Benchmark policy doc missing token: ${token}`)
}

for (const token of [
  "Benchmark Methodology",
  "Methodology Rules",
  "`benchmarks/ssr-throughput`",
  "`benchmarks/realworld`",
]) {
  assertIncludes(benchmarkMethodologyDoc, token, `Benchmark methodology doc missing token: ${token}`)
}

for (const token of [
  "SSR Benchmark Proof",
  "What It Proves",
  "What It Does Not Prove",
  "`benchmarks/ssr-throughput`",
]) {
  assertIncludes(ssrBenchmarkProofDoc, token, `SSR benchmark proof doc missing token: ${token}`)
}

for (const token of [
  "DOM Benchmark Proof",
  "What It Proves",
  "What It Does Not Prove",
  "`benchmarks/js-framework-bench`",
]) {
  assertIncludes(domBenchmarkProofDoc, token, `DOM benchmark proof doc missing token: ${token}`)
}

for (const token of [
  "Benchmark Artifacts",
  "benchmark-artifact.schema.json",
  "`metrics`",
  "machine-readable",
]) {
  assertIncludes(benchmarkArtifactsDoc, token, `Benchmark artifacts doc missing token: ${token}`)
}

for (const token of [
  "Benchmark Release Discipline",
  "Release Discussion Rules",
  "Public Claim Threshold",
  "reproducible",
]) {
  assertIncludes(benchmarkReleaseDisciplineDoc, token, `Benchmark release discipline doc missing token: ${token}`)
}

for (const token of [
  "Build Diagnostics",
  "missing client bundle",
  "hashed route bundle",
  "release smoke",
  "`backend`",
  "`phase`",
  "`code`",
]) {
  assertIncludes(buildDiagnosticsDoc, token, `Build diagnostics doc missing token: ${token}`)
}

for (const token of [
  "Runtime Failures",
  "Missing trusted origin for production runtime",
  "route/document/partial",
  "request.error",
]) {
  assertIncludes(runtimeFailuresDoc, token, `Runtime failures doc missing token: ${token}`)
}

for (const token of [
  "Cache Invalidation",
  "`private`",
  "`public`",
  "`no-store`",
]) {
  assertIncludes(cacheInvalidationDoc, token, `Cache invalidation doc missing token: ${token}`)
}

for (const token of [
  "Streaming and Hydration Failures",
  "wrapHTML",
  "smallest hydration boundary",
  "X-Gorsee-Navigate: partial",
]) {
  assertIncludes(streamingHydrationFailuresDoc, token, `Streaming/hydration failures doc missing token: ${token}`)
}

for (const token of [
  "Runtime Triage",
  "gorsee ai doctor",
  "bun run test:confidence",
  ".gorsee/agent/latest.json",
]) {
  assertIncludes(runtimeTriageDoc, token, `Runtime triage doc missing token: ${token}`)
}

for (const token of [
  "Starter Failures",
  "APP_ORIGIN",
  "security.rpc.middlewares",
  "docs/RUNTIME_FAILURES.md",
]) {
  assertIncludes(starterFailuresDoc, token, `Starter failures doc missing token: ${token}`)
}

for (const token of [
  "AI Workflows",
  "human + agent collaboration",
  "gorsee ai doctor",
  "gorsee ai pack",
]) {
  assertIncludes(aiWorkflowsDoc, token, `AI workflows doc missing token: ${token}`)
}

for (const token of [
  "AI IDE Sync Workflow",
  "gorsee ai ide-sync",
  ".gorsee/ide/context.md",
]) {
  assertIncludes(aiIdeSyncWorkflowDoc, token, `AI IDE sync workflow doc missing token: ${token}`)
}

for (const token of [
  "AI MCP Workflow",
  "gorsee ai mcp",
  "stdio MCP server",
]) {
  assertIncludes(aiMcpWorkflowDoc, token, `AI MCP workflow doc missing token: ${token}`)
}

for (const token of [
  "AI Bridge Workflow",
  "gorsee ai bridge",
  "best-effort only",
]) {
  assertIncludes(aiBridgeWorkflowDoc, token, `AI bridge workflow doc missing token: ${token}`)
}

for (const token of [
  "AI Tool Builders",
  "GORSEE_AI_CONTEXT_SCHEMA_VERSION",
  ".gorsee/agent/latest.json",
]) {
  assertIncludes(aiToolBuildersDoc, token, `AI tool builders doc missing token: ${token}`)
}

for (const token of [
  "AI Surface Stability",
  "Stable Surfaces",
  "Evolving Surfaces",
  "gorsee ai pack",
]) {
  assertIncludes(aiSurfaceStabilityDoc, token, `AI surface stability doc missing token: ${token}`)
}

for (const token of [
  "AI Session Packs",
  ".gorsee/agent/latest.json",
  "Session A:",
  "Session B:",
]) {
  assertIncludes(aiSessionPacksDoc, token, `AI session packs doc missing token: ${token}`)
}

for (const token of [
  "AI Debugging Workflows",
  "gorsee ai doctor",
  "gorsee ai export --bundle --format markdown",
  "gorsee ai mcp",
]) {
  assertIncludes(aiDebuggingWorkflowsDoc, token, `AI debugging workflows doc missing token: ${token}`)
}

for (const token of [
  "Starter Onboarding",
  "Choose an App Class",
  "Secure SaaS App",
  "Workspace / Monorepo App",
]) {
  assertIncludes(starterOnboardingDoc, token, `Starter onboarding doc missing token: ${token}`)
}

for (const token of [
  "Migration Guide",
  "gorsee/client",
  "gorsee/server",
  "root `gorsee`",
]) {
  assertIncludes(migrationGuideDoc, token, `Migration guide missing token: ${token}`)
}

for (const token of [
  "Upgrade Playbook",
  "stable",
  "canary",
  "rc",
  "bun run test:confidence",
]) {
  assertIncludes(upgradePlaybookDoc, token, `Upgrade playbook missing token: ${token}`)
}

for (const token of [
  "Deploy Target Guide",
  "Bun / Docker",
  "Fly.io",
  "Cloudflare",
  "Vercel",
]) {
  assertIncludes(deployTargetGuideDoc, token, `Deploy target guide missing token: ${token}`)
}

for (const token of [
  "First Production Rollout",
  "Before Rollout",
  "During Rollout",
  "After Rollout",
]) {
  assertIncludes(firstProductionRolloutDoc, token, `First production rollout doc missing token: ${token}`)
}

for (const token of [
  "Auth / Cache / Data Paths",
  "Secure SaaS App",
  "Content / Marketing Site",
  "Agent-Aware Internal Tool",
]) {
  assertIncludes(authCacheDataPathsDoc, token, `Auth/cache/data paths doc missing token: ${token}`)
}

for (const token of [
  "Recipe Boundaries",
  "Do Not Use Secure SaaS",
  "Do Not Use Content Site",
  "Do Not Use Workspace / Monorepo",
]) {
  assertIncludes(recipeBoundariesDoc, token, `Recipe boundaries doc missing token: ${token}`)
}

for (const token of [
  "Workspace Adoption",
  "apps/web",
  "packages/*",
  "root `gorsee`",
]) {
  assertIncludes(workspaceAdoptionDoc, token, `Workspace adoption doc missing token: ${token}`)
}

for (const token of [
  "Team Failures",
  "Common Team-Level Failures",
  "RPC protection",
  "placeholder origins",
]) {
  assertIncludes(teamFailuresDoc, token, `Team failures doc missing token: ${token}`)
}

for (const token of [
  "Maturity Policy",
  "Core Rules",
  "support claims",
  "release discipline",
]) {
  assertIncludes(maturityPolicyDoc, token, `Maturity policy doc missing token: ${token}`)
}

for (const token of [
  "Dependency Policy",
  "prefer no new dependency",
  "dependency-light runtime identity",
]) {
  assertIncludes(dependencyPolicyDoc, token, `Dependency policy doc missing token: ${token}`)
}

for (const token of [
  "Compatibility Guardrails",
  "root `gorsee`",
  "`gorsee/client`",
  "`gorsee/server`",
]) {
  assertIncludes(compatibilityGuardrailsDoc, token, `Compatibility guardrails doc missing token: ${token}`)
}

for (const token of [
  "Ambiguity Policy",
  "one clear path",
  "Ambiguity Signals",
  "product defect",
]) {
  assertIncludes(ambiguityPolicyDoc, token, `Ambiguity policy doc missing token: ${token}`)
}

for (const token of [
  "DX Feedback Loop",
  "Feedback Loop",
  "recurring friction",
  "tribal knowledge",
]) {
  assertIncludes(dxFeedbackLoopDoc, token, `DX feedback loop doc missing token: ${token}`)
}

for (const token of [
  "Evidence Policy",
  "Evidence Sources",
  "benchmark docs",
  "release smoke",
]) {
  assertIncludes(evidencePolicyDoc, token, `Evidence policy doc missing token: ${token}`)
}

for (const token of [
  "Roadmap Completion Policy",
  "Completion Rule",
  "Not Enough",
  "aspirational wording",
]) {
  assertIncludes(roadmapCompletionPolicyDoc, token, `Roadmap completion policy doc missing token: ${token}`)
}

for (const token of [
  "package manager contract: `bun@1.3.9`",
  "primary runtime target: Bun",
  "development server via `gorsee dev`",
  "production runtime via `gorsee start`",
]) {
  assertIncludes(supportMatrixDoc, token, `Support matrix missing token: ${token}`)
}

for (const token of [
  "Stable APIs",
  "Compatibility APIs",
  "Experimental APIs",
  "release notes entry",
  "migration guidance",
]) {
  assertIncludes(deprecationPolicyDoc, token, `Deprecation policy missing token: ${token}`)
}

console.log(`product:policy OK (${packageJson.version})`)

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}
