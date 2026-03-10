import { readFile, rm, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { pathToFileURL } from "node:url"
import type { MiddlewareFn } from "../server/middleware.ts"
import { resolveAIObservabilityConfig, type AIObservabilityConfig } from "../ai/index.ts"
import type { AsyncRateLimiter } from "../security/redis-rate-limit.ts"
import type { RateLimiter } from "../security/rate-limit.ts"

export interface AppSecurityRateLimitConfig {
  maxRequests?: number
  window?: string
  limiter?: RateLimiter | AsyncRateLimiter
}

export type AppMode = "frontend" | "fullstack" | "server"

export interface AppConfig {
  app?: {
    mode?: AppMode
  }
  ai?: AIObservabilityConfig
  runtime?: {
    topology?: RuntimeTopology
  }
  security?: {
    origin?: string
    hosts?: string[]
    proxy?: {
      preset?: ProxyPreset
      trustForwardedHeaders?: boolean
      trustedForwardedHops?: number
    }
    rateLimit?: AppSecurityRateLimitConfig
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

export type RuntimeTopology = "single-instance" | "multi-instance"

export function resolveAppMode(config: AppConfig): AppMode {
  switch (config.app?.mode) {
    case "frontend":
    case "server":
      return config.app.mode
    case "fullstack":
    default:
      return "fullstack"
  }
}

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
      const ext = extname(configPath) || ".ts"
      const configDir = dirname(configPath)
      const configBase = basename(configPath, ext)
      const tempConfigPath = join(
        configDir,
        `.${configBase}.gorsee-load-${process.pid}-${configStat.mtimeMs}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
      )
      try {
        await writeFile(tempConfigPath, await readFile(configPath, "utf-8"), "utf-8")
        const mod = await import(pathToFileURL(tempConfigPath).href)
        return ((mod.default ?? {}) as AppConfig)
      } finally {
        await rm(tempConfigPath, { force: true }).catch(() => {})
      }
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

export function resolveRuntimeTopology(config: AppConfig): RuntimeTopology {
  return config.runtime?.topology === "multi-instance" ? "multi-instance" : "single-instance"
}

export function resolveSecurityRateLimit(config: AppConfig): AppSecurityRateLimitConfig | undefined {
  return config.security?.rateLimit
}

export function resolveAIConfig(
  cwd: string,
  config: AppConfig,
  explicitConfig?: AIObservabilityConfig,
): AIObservabilityConfig | undefined {
  if (!config.ai && !explicitConfig) return undefined
  const merged = {
    ...(config.ai ?? {}),
    ...(explicitConfig ?? {}),
    app: explicitConfig?.app ?? config.ai?.app ?? {
      mode: resolveAppMode(config),
      runtimeTopology: resolveRuntimeTopology(config),
    },
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
