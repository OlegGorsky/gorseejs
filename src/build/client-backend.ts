import { createRolldownClientBuildBackend } from "./backends/rolldown.ts"
import { resolveBuildPluginsForTarget, type FrameworkBuildPlugin } from "./plugin.ts"
import { normalizeClientBuildLog, type ClientBuildLog } from "./diagnostics.ts"

export type ClientBuildPlugin = FrameworkBuildPlugin

export interface ClientBuildBackendOptions {
  entrypoints: string[]
  outdir: string
  minify: boolean
  sourcemap: boolean
  frameworkResolve(specifier: string): string | undefined
  plugins: ClientBuildPlugin[]
}

export interface ClientBuildBackendResult {
  success: boolean
  logs: ClientBuildLog[]
}

export interface ClientBuildBackend {
  name: string
  build(options: ClientBuildBackendOptions): Promise<ClientBuildBackendResult>
}

export const GORSEE_BUILD_BACKEND_ENV = "GORSEE_BUILD_BACKEND"

const internalBunFallback = createBunClientBuildBackend()
const stableRolldownBackend = createRolldownClientBuildBackend({ fallback: internalBunFallback })
const clientBuildBackends = new Map<string, ClientBuildBackend>([
  [internalBunFallback.name, internalBunFallback],
  [stableRolldownBackend.name, stableRolldownBackend],
])

export function createBunClientBuildBackend(): ClientBuildBackend {
  return {
    name: "bun",
    async build(options) {
      const result = await Bun.build({
        entrypoints: options.entrypoints,
        outdir: options.outdir,
        target: "browser",
        format: "esm",
        minify: options.minify,
        sourcemap: options.sourcemap ? "external" : "none",
        splitting: true,
        jsx: {
          runtime: "automatic",
          importSource: "gorsee",
          development: true,
        },
        plugins: [
          {
            name: "gorsee-client-resolve",
            setup(build) {
              build.onResolve({ filter: /^gorsee:route:/ }, (args) => ({
                path: args.path.slice("gorsee:route:".length),
              }))

              build.onResolve({ filter: /^gorsee(\/.*)?$/ }, (args) => {
                const mapped = options.frameworkResolve(args.path)
                if (mapped) return { path: mapped }
                return undefined
              })
            },
          },
          ...resolveBuildPluginsForTarget(options.plugins, "bun"),
        ],
      })

      return {
        success: result.success,
        logs: result.logs.map((log) => normalizeClientBuildLog({
          message: log.message,
        }, {
          backend: "bun",
          phase: "bundle",
          severity: "error",
          code: "BUN_BUILD_FAILURE",
        })),
      }
    },
  }
}

let defaultClientBuildBackend: ClientBuildBackend = stableRolldownBackend

export function getClientBuildBackend(): ClientBuildBackend {
  return defaultClientBuildBackend
}

export function setClientBuildBackend(backend: ClientBuildBackend): void {
  clientBuildBackends.set(backend.name, backend)
  defaultClientBuildBackend = backend
}

export function resetClientBuildBackend(): void {
  clientBuildBackends.clear()
  clientBuildBackends.set(internalBunFallback.name, internalBunFallback)
  clientBuildBackends.set(stableRolldownBackend.name, stableRolldownBackend)
  defaultClientBuildBackend = stableRolldownBackend
}

export function registerClientBuildBackend(backend: ClientBuildBackend): void {
  clientBuildBackends.set(backend.name, backend)
}

export function unregisterClientBuildBackend(name: string): void {
  if (name === stableRolldownBackend.name) return
  clientBuildBackends.delete(name)
  if (defaultClientBuildBackend.name === name) {
    defaultClientBuildBackend = stableRolldownBackend
  }
}

export function listClientBuildBackends(): string[] {
  return [...clientBuildBackends.keys()].sort()
}

export function selectClientBuildBackend(name: string): ClientBuildBackend {
  const backend = clientBuildBackends.get(name)
  if (!backend) {
    throw new Error(
      `Unknown client build backend "${name}". Registered backends: ${listClientBuildBackends().join(", ")}`,
    )
  }
  defaultClientBuildBackend = backend
  return backend
}

export function resolveClientBuildBackendName(env: NodeJS.ProcessEnv = process.env): string {
  return env[GORSEE_BUILD_BACKEND_ENV]?.trim() || stableRolldownBackend.name
}

export function configureClientBuildBackend(env: NodeJS.ProcessEnv = process.env): ClientBuildBackend {
  return selectClientBuildBackend(resolveClientBuildBackendName(env))
}

export type { ClientBuildLog }
