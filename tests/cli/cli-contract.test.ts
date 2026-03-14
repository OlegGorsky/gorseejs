import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dir, "../..")
const cliSource = readFileSync(join(REPO_ROOT, "src/cli/index.ts"), "utf-8")
const cliContract = JSON.parse(readFileSync(join(REPO_ROOT, "docs/CLI_CONTRACT.json"), "utf-8")) as {
  topLevelCommands: Array<{ command: string }>
  aiSubcommands: Array<{ command: string }>
}
const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf-8")
const agentsDoc = readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf-8")
const frameworkGenerator = readFileSync(join(REPO_ROOT, "src/cli/framework-md.ts"), "utf-8")

describe("cli contract", () => {
  test("keeps the top-level command matrix aligned across code and docs", () => {
    const commandEntries = extractCommandEntries(cliSource)
    const contractEntries = cliContract.topLevelCommands.map((entry) => entry.command)

    expect(commandEntries.sort()).toEqual(contractEntries.sort())
    expect(readme).toContain("docs/CLI_CONTRACT.json")
    expect(agentsDoc).toContain("docs/CLI_CONTRACT.json")
    expect(readme).toContain("gorsee worker")
    expect(readme).toContain("gorsee test")
  })

  test("keeps the AI CLI contract aligned across docs and framework reference generator", () => {
    for (const subcommand of cliContract.aiSubcommands.map((entry) => entry.command)) {
      if (subcommand === "help") continue
      expect(frameworkGenerator).toContain(`gorsee ai ${subcommand}`)
    }

    expect(agentsDoc).toContain("gorsee ai init")
    expect(agentsDoc).toContain("W928")
    expect(agentsDoc).toContain("W929")
  })
})

function extractCommandEntries(source: string): string[] {
  const match = source.match(/const COMMANDS: Record<string, string> = \{([\s\S]*?)\n\}/)
  if (!match) throw new Error("failed to locate COMMANDS map in src/cli/index.ts")
  const body = match[1] ?? ""
  const entries: string[] = []
  for (const entry of body.matchAll(/\b([a-z-]+):\s*"/g)) {
    if (entry[1]) entries.push(entry[1])
  }
  return entries
}
