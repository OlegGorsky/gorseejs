import { describe, expect, test } from "bun:test"
import {
  attachRequestMetadata,
  classifyRouteRequest,
  resolveRequestExecutionPolicy,
  resolveRequestMetadata,
  validateRequestPolicy,
} from "../../src/server/request-policy.ts"

describe("request policy", () => {
  test("classifies partial navigation as internal partial request", () => {
    const kind = classifyRouteRequest({}, new Request("http://localhost/dashboard", {
      headers: {
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    }))

    expect(kind).toBe("partial")
  })

  test("captures forwarded request metadata without trusting it by default", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/profile", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Origin: "https://app.example.com",
        "X-Forwarded-Host": "evil.proxy",
        "X-Forwarded-Proto": "http",
        "X-Forwarded-For": "203.0.113.10",
      },
    }), {
      kind: "action",
      trustedOrigin: "https://app.example.com",
    })

    expect(metadata.kind).toBe("action")
    expect(metadata.visibility).toBe("public")
    expect(metadata.host).toBe("localhost:3000")
    expect(metadata.forwardedHost).toBe("evil.proxy")
    expect(metadata.forwardedProto).toBe("http")
    expect(metadata.forwardedFor).toBe("203.0.113.10")
    expect(metadata.effectiveHost).toBe("localhost:3000")
    expect(metadata.effectiveProto).toBe("http")
    expect(metadata.proxyTrusted).toBe(false)
  })

  test("trusts forwarded host/proto only when explicitly enabled", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/profile", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Forwarded: 'for=203.0.113.10;proto=https;host="app.example.com"',
      },
    }), {
      kind: "action",
      trustForwardedHeaders: true,
    })

    expect(metadata.forwardedHost).toBe("app.example.com")
    expect(metadata.forwardedProto).toBe("https")
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
    expect(metadata.effectiveOrigin).toBe("https://app.example.com")
    expect(metadata.proxyTrusted).toBe(true)
  })

  test("uses trusted forwarded hop from the end of the chain", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/profile", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Forwarded: 'for=198.51.100.1;proto=http;host="outer.example", for=203.0.113.10;proto=https;host="app.example.com"',
        "X-Forwarded-Host": "outer.example, app.example.com",
        "X-Forwarded-Proto": "http, https",
      },
    }), {
      kind: "action",
      trustForwardedHeaders: true,
      trustedForwardedHops: 1,
    })

    expect(metadata.forwardedHost).toBe("app.example.com")
    expect(metadata.forwardedProto).toBe("https")
    expect(metadata.effectiveHost).toBe("app.example.com")
    expect(metadata.effectiveProto).toBe("https")
  })

  test("ignores malformed forwarded proto and host values even when proxy trust is enabled", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/profile", {
      headers: {
        Host: "localhost:3000",
        Forwarded: 'for=203.0.113.10;proto=javascript;host="bad host"',
        "X-Forwarded-Host": "bad host",
        "X-Forwarded-Proto": "javascript",
      },
    }), {
      kind: "action",
      trustForwardedHeaders: true,
      trustedForwardedHops: 1,
    })

    expect(metadata.forwardedHost).toBeUndefined()
    expect(metadata.forwardedProto).toBeUndefined()
    expect(metadata.effectiveHost).toBe("localhost:3000")
    expect(metadata.effectiveProto).toBe("http")
  })

  test("rejects state-changing requests with mismatched origin", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/profile", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    }), {
      kind: "rpc",
      trustedOrigin: "https://app.example.com",
    })

    expect(validateRequestPolicy(metadata, {
      allowedContentTypes: ["application/json"],
    })?.status).toBe(403)
  })

  test("rejects state-changing requests with unsupported content type", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/profile", {
      method: "POST",
      headers: {
        Origin: "https://app.example.com",
        "Content-Type": "text/plain",
      },
      body: "x",
    }), {
      kind: "action",
      trustedOrigin: "https://app.example.com",
    })

    expect(validateRequestPolicy(metadata, {
      allowedContentTypes: ["application/json"],
    })?.status).toBe(415)
  })

  test("provides central execution policy per request kind", () => {
    const rpcPolicy = resolveRequestExecutionPolicy("rpc")
    const actionPolicy = resolveRequestExecutionPolicy("action")
    const pagePolicy = resolveRequestExecutionPolicy("page")

    expect(rpcPolicy.visibility).toBe("internal")
    expect(rpcPolicy.access).toBe("internal")
    expect(rpcPolicy.mutation).toBe("write")
    expect(rpcPolicy.responseShape).toBe("data")
    expect(rpcPolicy.allowedContentTypes).toContain("application/json")
    expect(rpcPolicy.allowedContentTypes).toContain("application/vnd.gorsee-rpc+json")
    expect(actionPolicy.allowedContentTypes).toContain("multipart/form-data")
    expect(actionPolicy.mutation).toBe("write")
    expect(pagePolicy.requiresTrustedOrigin).toBe(false)
    expect(pagePolicy.responseShape).toBe("document")
  })

  test("attaches normalized metadata to request locals", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/settings", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Origin: "https://app.example.com",
      },
      body: JSON.stringify({ ok: true }),
    }), {
      kind: "rpc",
      trustedOrigin: "https://app.example.com",
    })
    const locals: Record<string, unknown> = {}

    attachRequestMetadata(locals, metadata)

    expect(locals.requestKind).toBe("rpc")
    expect(locals.requestVisibility).toBe("internal")
    expect(locals.requestAccess).toBe("internal")
    expect(locals.requestMutation).toBe("write")
    expect(locals.requestResponseShape).toBe("data")
    expect(locals.requestHost).toBe("localhost:3000")
    expect(locals.requestOrigin).toBe("https://app.example.com")
    expect(locals.requestEffectiveOrigin).toBe("https://app.example.com")
    expect(locals.requestProxyTrusted).toBe(false)
  })
})
