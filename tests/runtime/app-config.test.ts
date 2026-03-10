import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createGuard } from "../../src/server/guard.ts"
import {
  loadAppConfig,
  resolveAppMode,
  resolveAIConfig,
  resolveProxyPreset,
  resolveRuntimeTopology,
  resolveSecurityRateLimit,
  resolveRPCMiddlewares,
  resolveTrustedForwardedHops,
  resolveTrustedHosts,
  resolveTrustForwardedHeaders,
  resolveTrustedOrigin,
} from "../../src/runtime/app-config.ts"

const TMP = join(process.cwd(), ".tmp-app-config")

describe("runtime app config", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("loadAppConfig returns empty config when app.config.ts is missing", async () => {
    const config = await loadAppConfig(TMP)
    expect(config).toEqual({})
  })

  test("loadAppConfig loads rpc middlewares from app.config.ts", async () => {
    await writeFile(join(TMP, "app.config.ts"), `
      import { createGuard } from "gorsee/server"

      export default {
        security: {
          rpc: {
            middlewares: [createGuard(() => true)],
          },
        },
      }
    `.trim())

    const config = await loadAppConfig(TMP)
    const middlewares = resolveRPCMiddlewares(config)

    expect(Array.isArray(middlewares)).toBe(true)
    expect(middlewares).toHaveLength(1)
  })

  test("explicit rpcMiddlewares override app.config.ts middlewares", async () => {
    const config = {
      security: {
        rpc: {
          middlewares: [createGuard(() => false)],
        },
      },
    }
    const explicit = [createGuard(() => true)]

    const resolved = resolveRPCMiddlewares(config, explicit)

    expect(resolved).toBe(explicit)
  })

  test("resolveAIConfig merges app config and applies default sink paths", () => {
    const resolved = resolveAIConfig(TMP, {
      app: {
        mode: "server",
      },
      runtime: {
        topology: "multi-instance",
      },
      ai: {
        enabled: true,
        bridge: { url: "http://127.0.0.1:4318/gorsee/ai-events" },
      },
    })

    expect(resolved?.enabled).toBe(true)
    expect(resolved?.jsonlPath).toBe(join(TMP, ".gorsee", "ai-events.jsonl"))
    expect(resolved?.diagnosticsPath).toBe(join(TMP, ".gorsee", "ai-diagnostics.json"))
    expect(resolved?.app).toEqual({
      mode: "server",
      runtimeTopology: "multi-instance",
    })
    expect(resolved?.bridge?.url).toBe("http://127.0.0.1:4318/gorsee/ai-events")
  })

  test("resolveRuntimeTopology defaults to single-instance and honors multi-instance config", () => {
    expect(resolveRuntimeTopology({})).toBe("single-instance")
    expect(resolveRuntimeTopology({
      runtime: {
        topology: "multi-instance",
      },
    })).toBe("multi-instance")
  })

  test("resolveAppMode defaults to fullstack and honors explicit mode config", () => {
    expect(resolveAppMode({})).toBe("fullstack")
    expect(resolveAppMode({ app: { mode: "frontend" } })).toBe("frontend")
    expect(resolveAppMode({ app: { mode: "server" } })).toBe("server")
  })

  test("resolveSecurityRateLimit returns configured production limiter settings", () => {
    const limiter = {
      check: async () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 }),
      reset: async () => undefined,
    }
    expect(resolveSecurityRateLimit({})).toBeUndefined()
    expect(resolveSecurityRateLimit({
      security: {
        rateLimit: {
          maxRequests: 200,
          window: "1m",
          limiter,
        },
      },
    })).toEqual({
      maxRequests: 200,
      window: "1m",
      limiter,
    })
  })

  test("resolveTrustedOrigin prefers app config over environment", () => {
    const resolved = resolveTrustedOrigin(
      {
        security: {
          origin: "https://app.example.com",
        },
      },
      { APP_ORIGIN: "https://env.example.com" } as NodeJS.ProcessEnv,
    )

    expect(resolved).toBe("https://app.example.com")
  })

  test("resolveTrustForwardedHeaders defaults to false and honors app config", () => {
    expect(resolveTrustForwardedHeaders({})).toBe(false)
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          trustForwardedHeaders: true,
        },
      },
    })).toBe(true)
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          preset: "vercel",
        },
      },
    })).toBe(true)
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          preset: "netlify",
        },
      },
    })).toBe(true)
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          preset: "fly",
        },
      },
    })).toBe(true)
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          preset: "reverse-proxy",
        },
      },
    })).toBe(true)
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          preset: "cloudflare",
        },
      },
    })).toBe(false)
  })

  test("resolveTrustedForwardedHops defaults to 1 and normalizes invalid values", () => {
    expect(resolveTrustedForwardedHops({})).toBe(1)
    expect(resolveTrustedForwardedHops({
      security: {
        proxy: {
          trustedForwardedHops: 3,
        },
      },
    })).toBe(3)
    expect(resolveTrustedForwardedHops({
      security: {
        proxy: {
          trustedForwardedHops: 0,
        },
      },
    })).toBe(1)
    expect(resolveTrustedForwardedHops({
      security: {
        proxy: {
          preset: "netlify",
        },
      },
    })).toBe(1)
    expect(resolveTrustedForwardedHops({
      security: {
        proxy: {
          preset: "fly",
        },
      },
    })).toBe(1)
    expect(resolveTrustedForwardedHops({
      security: {
        proxy: {
          preset: "reverse-proxy",
        },
      },
    })).toBe(1)
    expect(resolveTrustedForwardedHops({
      security: {
        proxy: {
          preset: "cloudflare",
        },
      },
    })).toBe(0)
  })

  test("resolveProxyPreset defaults to none and returns configured provider preset", () => {
    expect(resolveProxyPreset({})).toBe("none")
    expect(resolveProxyPreset({
      security: {
        proxy: {
          preset: "fly",
        },
      },
    })).toBe("fly")
  })

  test("resolveTrustedHosts returns configured allowlist", () => {
    expect(resolveTrustedHosts({})).toEqual([])
    expect(resolveTrustedHosts({
      security: {
        hosts: ["app.example.com", "api.example.com"],
      },
    })).toEqual(["app.example.com", "api.example.com"])
  })

  test("explicit proxy settings override provider preset defaults", () => {
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          preset: "cloudflare",
          trustForwardedHeaders: true,
        },
      },
    })).toBe(true)
    expect(resolveTrustedForwardedHops({
      security: {
        proxy: {
          preset: "vercel",
          trustedForwardedHops: 2,
        },
      },
    })).toBe(2)
    expect(resolveTrustForwardedHeaders({
      security: {
        proxy: {
          preset: "fly",
          trustForwardedHeaders: false,
        },
      },
    })).toBe(false)
  })
})
