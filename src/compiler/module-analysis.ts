import {
  createTypeScriptModuleAnalysisBackend,
  type ModuleAnalysisBackend,
  type ModuleAnalysisFacts,
  type ModuleImportFact,
} from "./analysis-backend.ts"
import { createOxcModuleAnalysisBackend } from "./backends/oxc.ts"

export const GORSEE_COMPILER_BACKEND_ENV = "GORSEE_COMPILER_BACKEND"

const internalTypeScriptFallback = createTypeScriptModuleAnalysisBackend()
const stableOxcBackend = createOxcModuleAnalysisBackend({ fallback: internalTypeScriptFallback })
const moduleAnalysisBackends = new Map<string, ModuleAnalysisBackend>([
  [stableOxcBackend.name, stableOxcBackend],
])

let defaultModuleAnalysisBackend: ModuleAnalysisBackend = stableOxcBackend

export function analyzeModuleSource(filePath: string, content: string): ModuleAnalysisFacts {
  return defaultModuleAnalysisBackend.analyzeModuleSource(filePath, content)
}

export function getModuleAnalysisBackend(): ModuleAnalysisBackend {
  return defaultModuleAnalysisBackend
}

export function setModuleAnalysisBackend(backend: ModuleAnalysisBackend): void {
  moduleAnalysisBackends.set(backend.name, backend)
  defaultModuleAnalysisBackend = backend
}

export function resetModuleAnalysisBackend(): void {
  moduleAnalysisBackends.clear()
  moduleAnalysisBackends.set(stableOxcBackend.name, stableOxcBackend)
  defaultModuleAnalysisBackend = stableOxcBackend
}

export function registerModuleAnalysisBackend(backend: ModuleAnalysisBackend): void {
  moduleAnalysisBackends.set(backend.name, backend)
}

export function unregisterModuleAnalysisBackend(name: string): void {
  if (name === stableOxcBackend.name) return
  moduleAnalysisBackends.delete(name)
  if (defaultModuleAnalysisBackend.name === name) {
    defaultModuleAnalysisBackend = stableOxcBackend
  }
}

export function listModuleAnalysisBackends(): string[] {
  return [...moduleAnalysisBackends.keys()].sort()
}

export function selectModuleAnalysisBackend(name: string): ModuleAnalysisBackend {
  const backend = moduleAnalysisBackends.get(name)
  if (!backend) {
    throw new Error(
      `Unknown module analysis backend "${name}". Registered backends: ${listModuleAnalysisBackends().join(", ")}`,
    )
  }
  defaultModuleAnalysisBackend = backend
  return backend
}

export function resolveModuleAnalysisBackendName(env: NodeJS.ProcessEnv = process.env): string {
  return env[GORSEE_COMPILER_BACKEND_ENV]?.trim() || stableOxcBackend.name
}

export function configureModuleAnalysisBackend(env: NodeJS.ProcessEnv = process.env): ModuleAnalysisBackend {
  return selectModuleAnalysisBackend(resolveModuleAnalysisBackendName(env))
}

export type { ModuleAnalysisBackend, ModuleAnalysisFacts, ModuleImportFact }
