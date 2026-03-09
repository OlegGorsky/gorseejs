import { describe, expect, test } from "bun:test"
import { resolveRequestMetadata } from "../../src/server/request-policy.ts"

const FORWARDED_CASES = [
  'for=203.0.113.10;proto=https;host="app.example.com"',
  'for="[2001:db8::1]";proto="https";host="app.example.com:443"',
  'for=203.0.113.10;proto=https:;host="app.example.com"',
  'for=unknown;proto=javascript;host="evil.example"',
  'for=203.0.113.10;host="app.example.com";host="dup.example"',
  'for=203.0.113.10;proto=https, for=10.0.0.1;proto=http;host="internal"',
  'host=" spaced.example.com ";proto=" https "',
  'proto=;host=',
  '"broken',
]

describe("request metadata fuzz", () => {
  test("forwarded parsing stays fail-safe under malformed and edge-case inputs", () => {
    for (const forwarded of FORWARDED_CASES) {
      const request = new Request("http://localhost/account", {
        headers: {
          Host: "localhost:3000",
          Forwarded: forwarded,
        },
      })

      const metadata = resolveRequestMetadata(request, {
        kind: "page",
        trustForwardedHeaders: true,
      })

      expect(typeof metadata.effectiveHost).toBe("string")
      expect(typeof metadata.effectiveProto).toBe("string")
      expect(metadata.effectiveHost.length).toBeGreaterThan(0)
      expect(metadata.effectiveProto.length).toBeGreaterThan(0)
      expect(metadata.effectiveOrigin).toContain("://")
    }
  })

  test("untrusted forwarded metadata never overrides host/proto", () => {
    const metadata = resolveRequestMetadata(new Request("http://localhost/account", {
      headers: {
        Host: "localhost:3000",
        Forwarded: 'for=203.0.113.10;proto=https;host="app.example.com"',
      },
    }), {
      kind: "page",
      trustForwardedHeaders: false,
    })

    expect(metadata.effectiveHost).toBe("localhost:3000")
    expect(metadata.effectiveProto).toBe("http")
    expect(metadata.proxyTrusted).toBe(false)
  })
})
