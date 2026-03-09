import {
  GORSEE_COMPILER_BACKEND_ENV,
  getModuleAnalysisBackend,
  listModuleAnalysisBackends,
  resolveModuleAnalysisBackendName,
} from "./module-analysis.ts"

export interface CompilerBackendReadiness {
  envVar: typeof GORSEE_COMPILER_BACKEND_ENV
  stableDefault: "oxc"
  preferredCanary: "experimental-oxc"
  selected: string
  resolvedFromEnv: string
  registered: string[]
  experimental: string[]
}

export function getCompilerBackendReadiness(env: NodeJS.ProcessEnv = process.env): CompilerBackendReadiness {
  const registered = listModuleAnalysisBackends()
  return {
    envVar: GORSEE_COMPILER_BACKEND_ENV,
    stableDefault: "oxc",
    preferredCanary: "experimental-oxc",
    selected: getModuleAnalysisBackend().name,
    resolvedFromEnv: resolveModuleAnalysisBackendName(env),
    registered,
    experimental: registered.filter((name) => name.startsWith("experimental-")),
  }
}
