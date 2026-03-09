import type { ModuleAnalysisBackend, ModuleAnalysisFacts } from "../analysis-backend.ts"

export const EXPERIMENTAL_OXC_BACKEND_NAME = "experimental-oxc"

export interface ExperimentalOxcBackendOptions {
  fallback: ModuleAnalysisBackend
}

export function createExperimentalOxcModuleAnalysisBackend(
  options: ExperimentalOxcBackendOptions,
): ModuleAnalysisBackend {
  return {
    name: EXPERIMENTAL_OXC_BACKEND_NAME,
    analyzeModuleSource(filePath: string, content: string): ModuleAnalysisFacts {
      return options.fallback.analyzeModuleSource(filePath, content)
    },
  }
}
