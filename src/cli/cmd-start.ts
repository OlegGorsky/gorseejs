// gorsee start -- starts production server from dist/

import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { stat } from "node:fs/promises"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

export interface StartCommandOptions extends RuntimeOptions {
  port?: number
  runtime?: "bun" | "node"
}

interface StartFlags {
  runtime?: "bun" | "node"
}

export function parseStartFlags(args: string[]): StartFlags {
  const flags: StartFlags = {}
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--runtime" && (args[index + 1] === "bun" || args[index + 1] === "node")) {
      flags.runtime = args[++index] as "bun" | "node"
    }
  }
  return flags
}

export async function startBuiltProject(options: StartCommandOptions = {}) {
  const { paths } = createProjectContext(options)
  const runtime = options.runtime ?? "bun"

  // Verify build exists
  try {
    await stat(join(paths.distDir, "manifest.json"))
  } catch {
    console.error("\n  Error: No production build found.")
    console.error("  Run `gorsee build` first.\n")
    process.exit(1)
  }

  const entryFile = runtime === "node" ? "prod-node.js" : "prod.js"
  const prodEntry = pathToFileURL(join(paths.distDir, entryFile)).href
  const prodModule = await import(prodEntry)
  if (runtime === "node") {
    await prodModule.startNodeProductionServer({ cwd: paths.cwd, port: options.port })
    return
  }
  await prodModule.startProductionServer({ cwd: paths.cwd, port: options.port })
}

/** @deprecated Use startBuiltProject() for programmatic access. */
export async function runStart(args: string[], options: StartCommandOptions = {}) {
  const flags = parseStartFlags(args)
  return startBuiltProject({ ...options, runtime: flags.runtime ?? options.runtime })
}
