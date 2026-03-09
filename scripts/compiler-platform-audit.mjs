#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")

const groups = {
  buildBackend: [
    "src/build/client.ts",
    "src/build/server-strip.ts",
    "src/build/css-modules.ts",
    "src/cli/bun-plugin.ts",
  ],
  compilerAnalysis: [
    "src/cli/cmd-docs.ts",
    "src/cli/cmd-check.ts",
    "src/cli/check-ast.ts",
    "src/cli/cmd-typegen.ts",
    "src/router/scanner.ts",
  ],
  transforms: [
    "src/build/rpc-transform.ts",
    "src/build/server-strip.ts",
    "src/build/route-metadata.ts",
  ],
  generatedArtifacts: [
    "src/build/manifest.ts",
    "src/server/manifest.ts",
    "src/deploy/vercel.ts",
    "src/deploy/netlify.ts",
    "src/deploy/cloudflare.ts",
    "src/deploy/fly.ts",
    "src/deploy/dockerfile.ts",
  ],
  releaseGuardrails: [
    "scripts/release-check.mjs",
    "scripts/release-smoke.mjs",
    "scripts/install-matrix-check.mjs",
    "scripts/product-policy-check.mjs",
  ],
}

const detectors = {
  bunBuild: /\bBun\.build\b/g,
  bunPluginResolve: /\bonResolve\b/g,
  typescriptAst: /\btypescript\b|\bts\.createSourceFile\b|\bts\.getModifiers\b/g,
  regexTransforms: /RegExp|\.replace\(|match\(/g,
  generatedStrings: /return `|JSON\.stringify\(/g,
}

const summary = {
  generatedAt: new Date().toISOString(),
  groups: {},
  totals: {
    files: 0,
    bunBuild: 0,
    bunPluginResolve: 0,
    typescriptAst: 0,
    regexTransforms: 0,
    generatedStrings: 0,
  },
}

for (const [groupName, files] of Object.entries(groups)) {
  const groupSummary = []
  for (const relativePath of files) {
    const absolutePath = resolve(repoRoot, relativePath)
    const content = readFileSync(absolutePath, "utf-8")
    const counts = Object.fromEntries(
      Object.entries(detectors).map(([name, pattern]) => [name, [...content.matchAll(pattern)].length]),
    )
    summary.totals.files++
    for (const [name, count] of Object.entries(counts)) {
      summary.totals[name] += count
    }
    groupSummary.push({
      file: relativePath,
      counts,
    })
  }
  summary.groups[groupName] = groupSummary
}

console.log(JSON.stringify(summary, null, 2))
