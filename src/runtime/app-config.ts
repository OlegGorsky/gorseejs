import { stat } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { MiddlewareFn } from "../server/middleware.ts"
import { resolveAIObservabilityConfig, type AIObservabilityConfig } from "../ai/index.ts"

export interface AppConfig {
  ai?: AIObservabilityConfig
  security?: {
    origin?: string
    hosts?: string[]
    proxy?: {
      preset?: ProxyPreset
      trustForwardedHeaders?: boolean
      trustedForwardedHops?: number
    }
    rpc?: {
      middlewares?: MiddlewareFn[]
    }
  }
}

export type ProxyPreset =
  | "none"
  | "reverse-proxy"
  | "vercel"
  | "netlify"
  | "fly"
  | "cloudflare"

export async function loadAppConfig(cwd: string, explicitPath?: string): Promise<AppConfig> {
  const candidatePaths = explicitPath
    ? [explicitPath]
    : [
        join(cwd, "app.config.ts"),
        join(cwd, "app.config.js"),
        join(cwd, "app.config.mjs"),
      ]

  for (const configPath of candidatePaths) {
    try {
      const configStat = await stat(configPath)
      const configUrl = `${pathToFileURL(configPath).href}?t=${configStat.mtimeMs}`
      const mod = await import(configUrl)
      return ((mod.default ?? {}) as AppConfig)
    } catch {
      continue
    }
  }

  return {}
}

export function resolveRPCMiddlewares(
  config: AppConfig,
  explicitMiddlewares?: MiddlewareFn[],
): MiddlewareFn[] | undefined {
  if (explicitMiddlewares && explicitMiddlewares.length > 0) return explicitMiddlewares
  const configMiddlewares = config.security?.rpc?.middlewares
  return configMiddlewares && configMiddlewares.length > 0 ? configMiddlewares : undefined
}

export function resolveAIConfig(
  cwd: string,
  config: AppConfig,
  explicitConfig?: AIObservabilityConfig,
): AIObservabilityConfig | undefined {
  const merged = {
    ...(config.ai ?? {}),
    ...(explicitConfig ?? {}),
  }
  if (Object.keys(merged).length === 0) return undefined
  return resolveAIObservabilityConfig(cwd, merged)
}

export function resolveTrustedOrigin(
  config: AppConfig,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return config.security?.origin ?? env.APP_ORIGIN
}

export function resolveTrustForwardedHeaders(config: AppConfig): boolean {
  const explicit = config.security?.proxy?.trustForwardedHeaders
  if (typeof explicit === "boolean") return explicit
  return getProxyPresetDefaults(resolveProxyPreset(config)).trustForwardedHeaders
}

export function resolveTrustedForwardedHops(config: AppConfig): number {
  const hops = config.security?.proxy?.trustedForwardedHops
  if (typeof hops === "number" && Number.isFinite(hops) && hops > 0) return Math.floor(hops)
  return getProxyPresetDefaults(resolveProxyPreset(config)).trustedForwardedHops
}

export function resolveTrustedHosts(config: AppConfig): string[] {
  return config.security?.hosts ?? []
}

export function resolveProxyPreset(config: AppConfig): ProxyPreset {
  return config.security?.proxy?.preset ?? "none"
}

function getProxyPresetDefaults(preset: ProxyPreset): {
  trustForwardedHeaders: boolean
  trustedForwardedHops: number
} {
  switch (preset) {
    case "reverse-proxy":
    case "vercel":
    case "netlify":
    case "fly":
      return { trustForwardedHeaders: true, trustedForwardedHops: 1 }
    case "cloudflare":
      return { trustForwardedHeaders: false, trustedForwardedHops: 0 }
    case "none":
    default:
      return { trustForwardedHeaders: false, trustedForwardedHops: 1 }
  }
}
