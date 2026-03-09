import {
  GORSEE_BUILD_BACKEND_ENV,
  getClientBuildBackend,
  listClientBuildBackends,
  resolveClientBuildBackendName,
} from "./client-backend.ts"

export interface BuildBackendReadiness {
  envVar: typeof GORSEE_BUILD_BACKEND_ENV
  stableDefault: "rolldown"
  preferredCanary: "experimental-rolldown"
  selected: string
  resolvedFromEnv: string
  registered: string[]
  experimental: string[]
}

export function getBuildBackendReadiness(env: NodeJS.ProcessEnv = process.env): BuildBackendReadiness {
  const registered = listClientBuildBackends()
  return {
    envVar: GORSEE_BUILD_BACKEND_ENV,
    stableDefault: "rolldown",
    preferredCanary: "experimental-rolldown",
    selected: getClientBuildBackend().name,
    resolvedFromEnv: resolveClientBuildBackendName(env),
    registered,
    experimental: registered.filter((name) => name.startsWith("experimental-")),
  }
}
