// gorsee dev -- start dev server

import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

export interface DevCommandOptions extends RuntimeOptions {
  port?: number
}

export async function runDev(_args: string[], options: DevCommandOptions = {}) {
  const { cwd } = createProjectContext(options)
  const { startDevServer } = await import("../dev.ts")
  await startDevServer({ cwd, port: options.port })
}
