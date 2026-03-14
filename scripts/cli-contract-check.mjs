#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const agentsDoc = readFileSync(join(repoRoot, "AGENTS.md"), "utf-8")
const frameworkGenerator = readFileSync(join(repoRoot, "src/cli/framework-md.ts"), "utf-8")
const cliSource = readFileSync(join(repoRoot, "src/cli/index.ts"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const releasePolicy = readFileSync(join(repoRoot, "docs/RELEASE_POLICY.md"), "utf-8")
const releaseChecklist = readFileSync(join(repoRoot, "docs/RELEASE_CHECKLIST.md"), "utf-8")
const cliContract = JSON.parse(readFileSync(join(repoRoot, "docs/CLI_CONTRACT.json"), "utf-8"))

if (!packageJson.scripts?.["cli:policy"]?.includes("cli-contract-check.mjs")) {
  throw new Error("missing cli:policy script")
}

const commandEntries = extractCommandEntries(cliSource)
const contractCommands = cliContract.topLevelCommands.map((entry) => entry.command)
const contractAISubcommands = cliContract.aiSubcommands.map((entry) => entry.command)

assertEqualSets(commandEntries, contractCommands, "top-level CLI commands drifted from docs/CLI_CONTRACT.json")
assertIncludes(readme, "docs/CLI_CONTRACT.json", "README must reference docs/CLI_CONTRACT.json")
assertIncludes(agentsDoc, "docs/CLI_CONTRACT.json", "AGENTS must reference docs/CLI_CONTRACT.json")
assertIncludes(agentsDoc, "gorsee ai init", "AGENTS must describe ai init bootstrap")
assertIncludes(agentsDoc, "W928", "AGENTS must mention W928")
assertIncludes(agentsDoc, "W929", "AGENTS must mention W929")
assertIncludes(ciPolicy, "bun run cli:policy", "CI policy must require cli:policy")
assertIncludes(ciPolicy, "docs/CLI_CONTRACT.json", "CI policy must reference docs/CLI_CONTRACT.json")
assertIncludes(releasePolicy, "docs/CLI_CONTRACT.json", "Release policy must reference docs/CLI_CONTRACT.json")
assertIncludes(releaseChecklist, "docs/CLI_CONTRACT.json", "Release checklist must reference docs/CLI_CONTRACT.json")

for (const token of [
  "gorsee worker",
  "gorsee test",
  "gorsee ai init",
  "gorsee ai checkpoint",
  "gorsee ai pack",
]) {
  assertIncludes(readme, token, `README missing CLI token: ${token}`)
}

for (const subcommand of contractAISubcommands) {
  if (subcommand === "help") continue
  assertIncludes(frameworkGenerator, `gorsee ai ${subcommand}`, `framework generator missing AI subcommand token: ${subcommand}`)
}

console.log("cli:policy OK")

function extractCommandEntries(source) {
  const match = source.match(/const COMMANDS: Record<string, string> = \{([\s\S]*?)\n\}/)
  if (!match) {
    throw new Error("failed to locate COMMANDS map in src/cli/index.ts")
  }

  return [...match[1].matchAll(/\b([a-z-]+):\s*"/g)].map((entry) => entry[1])
}

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}

function assertEqualSets(actual, expected, message) {
  const actualSorted = [...actual].sort()
  const expectedSorted = [...expected].sort()
  if (actualSorted.length !== expectedSorted.length) {
    throw new Error(`${message}: length mismatch`)
  }
  for (let i = 0; i < actualSorted.length; i++) {
    if (actualSorted[i] !== expectedSorted[i]) {
      throw new Error(`${message}: ${actualSorted.join(", ")} !== ${expectedSorted.join(", ")}`)
    }
  }
}
