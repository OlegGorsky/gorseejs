import {
  createBunClientBuildBackend,
  registerClientBuildBackend,
  type ClientBuildBackend,
} from "../client-backend.ts"
import {
  createExperimentalRolldownClientBuildBackend,
  EXPERIMENTAL_ROLLDOWN_BACKEND_NAME,
} from "./experimental-rolldown.ts"
import {
  createRolldownClientBuildBackend,
  ROLLDOWN_BACKEND_NAME,
} from "./rolldown.ts"

export interface RegisterBuiltInBuildBackendsOptions {
  includeExperimentalRolldown?: boolean
  includeRolldown?: boolean
  fallbackBackend?: ClientBuildBackend
}

export function registerBuiltInBuildBackends(
  options: RegisterBuiltInBuildBackendsOptions = {},
): string[] {
  const registered: string[] = []
  const fallbackBackend = options.fallbackBackend ?? createBunClientBuildBackend()

  if (options.includeExperimentalRolldown) {
    registerClientBuildBackend(createExperimentalRolldownClientBuildBackend({ fallback: fallbackBackend }))
    registered.push(EXPERIMENTAL_ROLLDOWN_BACKEND_NAME)
  }

  if (options.includeRolldown) {
    registerClientBuildBackend(createRolldownClientBuildBackend({ fallback: fallbackBackend }))
    registered.push(ROLLDOWN_BACKEND_NAME)
  }

  return registered
}
