import { createTypeScriptModuleAnalysisBackend, type ModuleAnalysisBackend } from "../analysis-backend.ts"
import { registerModuleAnalysisBackend } from "../module-analysis.ts"
import {
  createExperimentalOxcModuleAnalysisBackend,
  EXPERIMENTAL_OXC_BACKEND_NAME,
} from "./experimental-oxc.ts"
import {
  createOxcModuleAnalysisBackend,
  OXC_BACKEND_NAME,
} from "./oxc.ts"

export interface RegisterBuiltInCompilerBackendsOptions {
  includeExperimentalOxc?: boolean
  includeOxc?: boolean
  fallbackBackend?: ModuleAnalysisBackend
}

export function registerBuiltInCompilerBackends(
  options: RegisterBuiltInCompilerBackendsOptions = {},
): string[] {
  const registered: string[] = []
  const fallbackBackend = options.fallbackBackend ?? createTypeScriptModuleAnalysisBackend()

  if (options.includeExperimentalOxc) {
    registerModuleAnalysisBackend(createExperimentalOxcModuleAnalysisBackend({ fallback: fallbackBackend }))
    registered.push(EXPERIMENTAL_OXC_BACKEND_NAME)
  }

  if (options.includeOxc) {
    registerModuleAnalysisBackend(createOxcModuleAnalysisBackend({ fallback: fallbackBackend }))
    registered.push(OXC_BACKEND_NAME)
  }

  return registered
}
