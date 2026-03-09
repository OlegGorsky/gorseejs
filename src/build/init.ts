import { registerBuiltInBuildBackends } from "./backends/register.ts"
import { configureClientBuildBackend } from "./client-backend.ts"

export function initializeBuildBackends(env: NodeJS.ProcessEnv = process.env) {
  registerBuiltInBuildBackends({ includeExperimentalRolldown: true, includeRolldown: true })
  return configureClientBuildBackend(env)
}
