#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const agentsDoc = readFileSync(join(repoRoot, "AGENTS.md"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const releasePolicy = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const releaseChecklist = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const aiIntegrationContract = readFileSync(join(repoRoot, "docs/AI_INTEGRATION_CONTRACT.json"), "utf-8")

const docs = [
  ["docs/AI_WORKFLOWS.md", ["mature product", "human + agent collaboration", "gorsee ai doctor", "gorsee ai pack"]],
  ["docs/AI_IDE_SYNC_WORKFLOW.md", ["mature product", "gorsee ai ide-sync", ".gorsee/ide/context.md"]],
  ["docs/AI_MCP_WORKFLOW.md", ["mature product", "gorsee ai mcp", "stdio MCP server"]],
  ["docs/AI_BRIDGE_WORKFLOW.md", ["mature product", "gorsee ai bridge", "best-effort only"]],
  ["docs/AI_TOOL_BUILDERS.md", ["mature product", "GORSEE_AI_CONTEXT_SCHEMA_VERSION", ".gorsee/agent/latest.json"]],
  ["docs/AI_SURFACE_STABILITY.md", ["mature product", "Stable Surfaces", "Evolving Surfaces", "gorsee ai pack"]],
  ["docs/AI_SESSION_PACKS.md", ["mature product", "gorsee ai pack", ".gorsee/agent/latest.json", "Session A:"]],
  ["docs/AI_DEBUGGING_WORKFLOWS.md", ["mature product", "gorsee ai doctor", "gorsee ai export --bundle --format markdown", "gorsee ai mcp"]],
]

if (!packageJson.scripts?.["ai:policy"]?.includes("ai-policy-check.mjs")) {
  throw new Error("missing ai:policy script")
}

for (const token of [
  "AI Workflows",
  "AI IDE Sync Workflow",
  "AI MCP Workflow",
  "AI Bridge Workflow",
  "AI Tool Builders",
  "AI Surface Stability",
  "AI Integration Contract",
  "AI Session Packs",
  "AI Debugging Workflows",
]) {
  assertIncludes(readme, token, `README missing AI workflow reference: ${token}`)
}

for (const token of [
  "\"localIntegrationSurfaces\"",
  "\"ide-projection\"",
  "\"session-pack-handoff\"",
  "\"remainingExternalGap\"",
  "provider-direct or self-hosted",
]) {
  assertIncludes(aiIntegrationContract, token, `AI integration contract missing token: ${token}`)
}

for (const [relativePath, tokens] of docs) {
  const source = readFileSync(join(repoRoot, relativePath), "utf-8")
  for (const token of tokens) {
    assertIncludes(source, token, `${relativePath} missing token: ${token}`)
  }
}

assertIncludes(agentsDoc, "docs/AI_WORKFLOWS.md", "AGENTS must reference AI workflows")
assertIncludes(agentsDoc, "docs/AI_SURFACE_STABILITY.md", "AGENTS must reference AI surface stability")
assertIncludes(agentsDoc, "docs/AI_INTEGRATION_CONTRACT.json", "AGENTS must reference AI integration contract")
assertIncludes(ciPolicy, "AI Workflow Surface", "CI policy must define AI workflow surface")
assertIncludes(ciPolicy, "bun run ai:policy", "CI policy must require ai:policy")
assertIncludes(releasePolicy, "docs/AI_WORKFLOWS.md", "Release policy must reference AI workflows")
assertIncludes(releaseChecklist, "docs/AI_WORKFLOWS.md", "Release checklist must reference AI workflows")

console.log("ai:policy OK")

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}
