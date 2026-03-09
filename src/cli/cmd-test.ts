// gorsee test -- smart test runner wrapping bun test

import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

interface TestFlags {
  watch: boolean
  coverage: boolean
  filter: string | null
  e2e: boolean
  unit: boolean
  integration: boolean
}

function parseFlags(args: string[]): TestFlags {
  const flags: TestFlags = {
    watch: false,
    coverage: false,
    filter: null,
    e2e: false,
    unit: false,
    integration: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === "--watch") flags.watch = true
    else if (arg === "--coverage") flags.coverage = true
    else if (arg === "--filter" && args[i + 1]) flags.filter = args[++i]!
    else if (arg === "--e2e") flags.e2e = true
    else if (arg === "--unit") flags.unit = true
    else if (arg === "--integration") flags.integration = true
  }

  return flags
}

async function findTestFiles(dir: string, pattern: RegExp): Promise<string[]> {
  const results: string[] = []
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist") continue
    const fullPath = join(dir, entry)
    const s = await stat(fullPath)
    if (s.isDirectory()) {
      results.push(...(await findTestFiles(fullPath, pattern)))
    } else if (pattern.test(fullPath)) {
      results.push(fullPath)
    }
  }
  return results
}

function getTestPattern(flags: TestFlags): RegExp {
  if (flags.e2e) return /(?:\.e2e\.test\.ts$|e2e\/.*\.test\.ts$)/
  if (flags.integration) return /(?:\.integration\.test\.ts$|tests\/integration\/.*\.test\.ts$)/
  if (flags.unit) return /(?:\.unit\.test\.ts$|tests\/unit\/.*\.test\.ts$)/
  return /\.test\.ts$/
}

/** Build bun test args from parsed flags */
export function buildTestArgs(flags: TestFlags, files: string[]): string[] {
  const bunArgs = ["test"]

  if (flags.watch) bunArgs.push("--watch")
  if (flags.coverage) bunArgs.push("--coverage")
  if (flags.filter) {
    bunArgs.push("--bail", "--filter", flags.filter)
  }

  bunArgs.push(...files)
  return bunArgs
}

export interface TestCommandOptions extends RuntimeOptions {}

export async function runTests(args: string[], options: TestCommandOptions = {}) {
  const { cwd, env } = createProjectContext(options)
  const flags = parseFlags(args)
  const pattern = getTestPattern(flags)

  const files = await findTestFiles(cwd, pattern)

  if (files.length === 0) {
    const kind = flags.e2e ? "e2e" : flags.integration ? "integration" : flags.unit ? "unit" : "any"
    console.log(`\n  No ${kind} test files found.\n`)
    return
  }

  console.log(`\n  Running ${files.length} test file(s)...\n`)

  const bunArgs = buildTestArgs(flags, files)

  const proc = Bun.spawn(["bun", ...bunArgs], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...env,
      NODE_ENV: "test",
      GORSEE_TEST: "1",
    },
  })

  const exitCode = await proc.exited

  console.log()
  if (exitCode === 0) {
    console.log(`  Tests passed (${files.length} file(s))`)
  } else {
    console.log(`  Tests failed (exit code ${exitCode})`)
    process.exit(exitCode)
  }
}

/** @deprecated Use runTests() for programmatic access. */
export async function runTest(args: string[], options: TestCommandOptions = {}) {
  return runTests(args, options)
}

// Re-export for testing
export { parseFlags, findTestFiles, getTestPattern }
