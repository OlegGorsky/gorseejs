import type { ClientBuildBackend, ClientBuildBackendOptions, ClientBuildBackendResult } from "../client-backend.ts"

export const EXPERIMENTAL_ROLLDOWN_BACKEND_NAME = "experimental-rolldown"

export interface ExperimentalRolldownBackendOptions {
  fallback: ClientBuildBackend
}

export function createExperimentalRolldownClientBuildBackend(
  options: ExperimentalRolldownBackendOptions,
): ClientBuildBackend {
  return {
    name: EXPERIMENTAL_ROLLDOWN_BACKEND_NAME,
    async build(buildOptions: ClientBuildBackendOptions): Promise<ClientBuildBackendResult> {
      return options.fallback.build(buildOptions)
    },
  }
}
