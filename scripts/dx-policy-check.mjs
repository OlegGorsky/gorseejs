#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const releasePolicy = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const releaseChecklist = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const frameworkGenerator = readFileSync(join(repoRoot, "src/cli/framework-md.ts"), "utf-8")
const starterGenerator = readFileSync(join(repoRoot, "src/cli/cmd-create.ts"), "utf-8")

const docs = [
  ["docs/STARTER_ONBOARDING.md", ["mature product", "Choose an App Class", "Secure SaaS App", "Workspace / Monorepo App"]],
  ["docs/MIGRATION_GUIDE.md", ["mature product", "gorsee/client", "gorsee/server", "root `gorsee`"]],
  ["docs/UPGRADE_PLAYBOOK.md", ["mature product", "stable", "canary", "rc", "bun run test:confidence"]],
  ["docs/DEPLOY_TARGET_GUIDE.md", ["mature product", "Bun / Docker", "Fly.io", "Cloudflare", "Vercel"]],
  ["docs/FIRST_PRODUCTION_ROLLOUT.md", ["mature product", "Before Rollout", "During Rollout", "After Rollout"]],
  ["docs/AUTH_CACHE_DATA_PATHS.md", ["mature product", "Secure SaaS App", "Content / Marketing Site", "Agent-Aware Internal Tool"]],
  ["docs/RECIPE_BOUNDARIES.md", ["mature product", "Do Not Use Secure SaaS", "Do Not Use Content Site", "Do Not Use Workspace / Monorepo"]],
  ["docs/WORKSPACE_ADOPTION.md", ["mature product", "apps/web", "packages/*", "root `gorsee`"]],
  ["docs/TEAM_FAILURES.md", ["mature product", "Common Team-Level Failures", "RPC protection", "placeholder origins"]],
]

if (!packageJson.scripts?.["dx:policy"]?.includes("dx-policy-check.mjs")) {
  throw new Error("missing dx:policy script")
}

for (const token of [
  "Starter Onboarding",
  "Migration Guide",
  "Upgrade Playbook",
  "Deploy Target Guide",
  "First Production Rollout",
  "Auth / Cache / Data Paths",
  "Recipe Boundaries",
  "Workspace Adoption",
  "Team Failures",
]) {
  assertIncludes(readme, token, `README missing DX reference: ${token}`)
}

for (const [relativePath, tokens] of docs) {
  const source = readFileSync(join(repoRoot, relativePath), "utf-8")
  for (const token of tokens) {
    assertIncludes(source, token, `${relativePath} missing token: ${token}`)
  }
}

assertIncludes(ciPolicy, "DX Surface", "CI policy must define DX surface")
assertIncludes(ciPolicy, "bun run dx:policy", "CI policy must require dx:policy")
assertIncludes(releasePolicy, "docs/UPGRADE_PLAYBOOK.md", "Release policy must reference upgrade playbook")
assertIncludes(releaseChecklist, "docs/FIRST_PRODUCTION_ROLLOUT.md", "Release checklist must reference first rollout doc")
assertIncludes(frameworkGenerator, "docs/STARTER_ONBOARDING.md", "FRAMEWORK generator must link starter onboarding")
assertIncludes(frameworkGenerator, "docs/MIGRATION_GUIDE.md", "FRAMEWORK generator must link migration guide")
assertIncludes(starterGenerator, "docs/UPGRADE_PLAYBOOK.md", "Starter README must link upgrade playbook")
assertIncludes(starterGenerator, "docs/WORKSPACE_ADOPTION.md", "Starter README must link workspace adoption")

console.log("dx:policy OK")

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}
