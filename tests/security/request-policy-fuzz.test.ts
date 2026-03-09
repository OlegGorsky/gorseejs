import { describe, expect, test } from "bun:test"
import {
  resolveRequestExecutionPolicy,
  resolveRequestMetadata,
  validateRequestPolicy,
} from "../../src/server/request-policy.ts"
import {
  createRequestSecurityPolicy,
  validateRequestSecurityPolicy,
} from "../../src/server/request-security-policy.ts"

const FORWARDED_CASES = [
  "",
  "for=127.0.0.1",
  "for=127.0.0.1;proto=https;host=app.example.com",
  "for=\"[::1]\";proto=\"https\";host=\"app.example.com\"",
  "for=_hidden;host=evil.example",
  "host==broken;proto=https",
  ";;;;",
  "for=127.0.0.1, for=10.0.0.1;proto=http",
  "proto=https;host=app.example.com;for=127.0.0.1",
]

const ORIGIN_CASES = [
  undefined,
  "https://app.example.com",
  "https://evil.example",
  "null",
  "javascript:alert(1)",
  "://broken",
]

describe("request policy fuzz-like coverage", () => {
  test("malformed origin and forwarded inputs never crash metadata/security resolution", () => {
    for (const forwarded of FORWARDED_CASES) {
      for (const origin of ORIGIN_CASES) {
        const headers = new Headers({
          Host: "localhost:3000",
          "X-Forwarded-Host": "app.example.com",
          "X-Forwarded-Proto": "https",
        })
        if (forwarded) headers.set("Forwarded", forwarded)
        if (origin) headers.set("Origin", origin)

        const request = new Request("http://localhost:3000/api/_rpc/abcdef123456", {
          method: "POST",
          headers,
          body: JSON.stringify([]),
        })

        const metadata = resolveRequestMetadata(request, {
          trustedOrigin: "https://app.example.com",
          kind: "rpc",
          trustForwardedHeaders: true,
        })
        const policy = resolveRequestExecutionPolicy("rpc")
        const securityPolicy = createRequestSecurityPolicy({
          trustedOrigin: "https://app.example.com",
          trustForwardedHeaders: true,
          trustedHosts: ["app.example.com"],
          enforceTrustedHosts: true,
        })

        expect(() => validateRequestPolicy(metadata, policy)).not.toThrow()
        expect(() => validateRequestSecurityPolicy(metadata, policy, securityPolicy)).not.toThrow()
        expect(typeof metadata.effectiveHost).toBe("string")
        expect(typeof metadata.effectiveProto).toBe("string")
      }
    }
  })
})
