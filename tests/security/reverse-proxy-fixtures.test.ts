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

  test("netlify preset trusts one forwarded hop like vercel-style edge handlers", () => {
    const config = {
      security: {
        proxy: {
          preset: "netlify" as const,
        },
      },
    }
    const metadata = resolveRequestMetadata(new Request("http://127.0.0.1/account", {
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

    expect(resolveProxyPreset(config)).toBe("netlify")
    expect(metadata.proxyTrusted).toBe(true)
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
  })

  test("fly preset can explicitly opt out of forwarded trust", () => {
    const config = {
      security: {
        proxy: {
          preset: "fly" as const,
          trustForwardedHeaders: false,
        },
      },
    }
    const metadata = resolveRequestMetadata(new Request("https://fly.example.com/account", {
      headers: {
        Host: "fly.example.com",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "http",
      },
    }), {
      kind: "page",
      trustForwardedHeaders: resolveTrustForwardedHeaders(config),
      trustedForwardedHops: resolveTrustedForwardedHops(config),
    })

    expect(resolveProxyPreset(config)).toBe("fly")
    expect(metadata.proxyTrusted).toBe(false)
    expect(metadata.effectiveHost).toBe("fly.example.com")
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

  test("reverse-proxy preset trusts only the configured hop depth from chained forwarded headers", () => {
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

    const metadata = resolveRequestMetadata(new Request("http://internal/dashboard", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=http;host="outer.example.com", for=198.51.100.2;proto=https;host="app.example.com", for=203.0.113.10;proto=https;host="internal-hop.example"',
        "X-Forwarded-Host": "outer.example.com, app.example.com, internal-hop.example",
        "X-Forwarded-Proto": "http, https, https",
      },
    }), {
      kind: "page",
      trustedOrigin: config.security.origin,
      trustForwardedHeaders: resolveTrustForwardedHeaders(config),
      trustedForwardedHops: resolveTrustedForwardedHops(config),
    })

    expect(metadata.proxyTrusted).toBe(true)
    expect(metadata.forwardedHost).toBe("app.example.com")
    expect(metadata.forwardedProto).toBe("https")
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
  })

  test("reverse-proxy preset prefers canonical Forwarded values over conflicting X-Forwarded headers", () => {
    const config = {
      security: {
        origin: "https://app.example.com",
        hosts: ["app.example.com"],
        proxy: {
          preset: "reverse-proxy" as const,
          trustedForwardedHops: 1,
        },
      },
    }

    const metadata = resolveRequestMetadata(new Request("http://internal/dashboard", {
      headers: {
        Host: "internal",
        Forwarded: 'for=203.0.113.10;proto=https;host="app.example.com"',
        "X-Forwarded-Host": "evil.example.com",
        "X-Forwarded-Proto": "http",
      },
    }), {
      kind: "page",
      trustedOrigin: config.security.origin,
      trustForwardedHeaders: resolveTrustForwardedHeaders(config),
      trustedForwardedHops: resolveTrustedForwardedHops(config),
    })

    expect(metadata.proxyTrusted).toBe(true)
    expect(metadata.forwardedHost).toBe("app.example.com")
    expect(metadata.forwardedProto).toBe("https")
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
  })

  test("reverse-proxy preset can explicitly disable forwarded trust even when headers are present", () => {
    const config = {
      security: {
        proxy: {
          preset: "reverse-proxy" as const,
          trustForwardedHeaders: false,
          trustedForwardedHops: 2,
        },
      },
    }

    const metadata = resolveRequestMetadata(new Request("https://app.example.com/dashboard", {
      headers: {
        Host: "app.example.com",
        Forwarded: 'for=198.51.100.1;proto=http;host="outer.example.com", for=203.0.113.10;proto=https;host="trusted.example.com"',
        "X-Forwarded-Host": "outer.example.com, trusted.example.com",
        "X-Forwarded-Proto": "http, https",
      },
    }), {
      kind: "page",
      trustForwardedHeaders: resolveTrustForwardedHeaders(config),
      trustedForwardedHops: resolveTrustedForwardedHops(config),
    })

    expect(metadata.proxyTrusted).toBe(false)
    expect(metadata.forwardedHost).toBe("trusted.example.com")
    expect(metadata.forwardedProto).toBe("https")
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
  })
})
