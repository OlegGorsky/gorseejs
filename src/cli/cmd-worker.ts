import { stat } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { configureAIObservability, emitAIEvent } from "../ai/index.ts"
import { loadEnv } from "../env/index.ts"
import { loadAppConfig, resolveAIConfig, resolveAppMode } from "../runtime/app-config.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

export interface WorkerCommandOptions extends RuntimeOptions {}

interface WorkerFlags {
  entry: string
}

export function parseWorkerFlags(args: string[]): WorkerFlags {
  const flags: WorkerFlags = {
    entry: "workers/main.ts",
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) continue
    if (arg === "--entry" && args[index + 1]) {
      flags.entry = args[++index]!
    } else if (arg.startsWith("--entry=")) {
      flags.entry = arg.slice("--entry=".length)
    }
  }
  return flags
}

export async function runWorker(args: string[], options: WorkerCommandOptions = {}): Promise<void> {
  const flags = parseWorkerFlags(args)
  const { cwd } = createProjectContext(options)
  await loadEnv(cwd)
  const appConfig = await loadAppConfig(cwd)
  const appMode = resolveAppMode(appConfig)

  if (appMode !== "server") {
    console.error(`\n  Error: \`gorsee worker\` is only available for server-mode apps. Current app.mode is "${appMode}".\n`)
    process.exit(1)
  }

  configureAIObservability(resolveAIConfig(cwd, appConfig))

  const entryPath = join(cwd, flags.entry)
  try {
    await stat(entryPath)
  } catch {
    console.error(`\n  Error: Worker entry not found: ${flags.entry}\n`)
    process.exit(1)
  }

  await emitAIEvent({
    kind: "worker.command.start",
    severity: "info",
    source: "cli",
    message: "starting worker entry",
    data: {
      entry: flags.entry,
      appMode,
    },
  })

  try {
    await import(pathToFileURL(entryPath).href)
    await emitAIEvent({
      kind: "worker.command.finish",
      severity: "info",
      source: "cli",
      message: "worker entry finished",
      data: {
        entry: flags.entry,
        appMode,
      },
    })
  } catch (error) {
    await emitAIEvent({
      kind: "worker.command.error",
      severity: "error",
      source: "cli",
      message: error instanceof Error ? error.message : String(error),
      data: {
        entry: flags.entry,
        appMode,
      },
    })
    throw error
  }
}
