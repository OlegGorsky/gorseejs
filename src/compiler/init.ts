import { registerBuiltInCompilerBackends } from "./backends/register.ts"
import { configureModuleAnalysisBackend } from "./module-analysis.ts"

export function initializeCompilerBackends(env: NodeJS.ProcessEnv = process.env) {
  registerBuiltInCompilerBackends({ includeExperimentalOxc: true, includeOxc: true })
  return configureModuleAnalysisBackend(env)
}
