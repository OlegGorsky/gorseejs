import { describe, expect, test } from "bun:test"
import { createRequestSecurityPolicy, validateRequestSecurityPolicy } from "../../src/server/request-security-policy.ts"
import { resolveRequestExecutionPolicy, resolveRequestMetadata } from "../../src/server/request-policy.ts"
import { resolveProxyPreset, resolveTrustForwardedHeaders, resolveTrustedForwardedHops } from "../../src/runtime/app-config.ts"

describe("reverse proxy fixtures", () => {
  test("vercel-style single trusted hop resolves forwarded host/proto", () => {
    const config = {
      security: {
        proxy: {
          preset: "vercel" as const,
        },
      },
    }
    const metadata = resolveRequestMetadata(new Request("http://127.0.0.1/dashboard", {
      headers: {
        Host: "127.0.0.1",
        "X-Forwarded-Host": "app.example.com",
        "X-Forwarded-Proto": "https",
      },
    }), {
      kind: "page",
      trustForwardedHeaders: resolveTrustForwardedHeaders(config),
      trustedForwardedHops: resolveTrustedForwardedHops(config),
    })

    expect(resolveProxyPreset(config)).toBe("vercel")
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
  })

  test("cloudflare preset does not trust forwarded headers by default", () => {
    const config = {
      security: {
        proxy: {
          preset: "cloudflare" as const,
        },
      },
    }
    const metadata = resolveRequestMetadata(new Request("https://app.example.com/dashboard", {
      headers: {
        Host: "app.example.com",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "http",
      },
    }), {
      kind: "page",
      trustForwardedHeaders: resolveTrustForwardedHeaders(config),
      trustedForwardedHops: resolveTrustedForwardedHops(config),
    })

    expect(metadata.proxyTrusted).toBe(false)
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
  })

  test("reverse-proxy preset respects trusted host enforcement after forwarded resolution", () => {
    const config = {
      security: {
        origin: "https://app.example.com",
        hosts: ["app.example.com"],
        proxy: {
          preset: "reverse-proxy" as const,
          trustedForwardedHops: 2,
        },
      },
    }
    const securityPolicy = createRequestSecurityPolicy({
      trustedOrigin: config.security.origin,
      trustForwardedHeaders: resolveTrustForwardedHeaders(config),
      trustedForwardedHops: resolveTrustedForwardedHops(config),
      trustedHosts: config.security.hosts,
    })
    const metadata = resolveRequestMetadata(new Request("http://internal/dashboard", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=https;host="edge.example", for=203.0.113.10;proto=https;host="app.example.com"',
      },
    }), {
      kind: "page",
      trustedOrigin: config.security.origin,
      trustForwardedHeaders: securityPolicy.trustForwardedHeaders,
      trustedForwardedHops: securityPolicy.trustedForwardedHops,
    })

    expect(metadata.effectiveHost).toBe("edge.example")
    expect(
      validateRequestSecurityPolicy(metadata, resolveRequestExecutionPolicy("page"), securityPolicy)?.status,
    ).toBe(400)
  })
})
