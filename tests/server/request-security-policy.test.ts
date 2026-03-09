import { describe, expect, test } from "bun:test"
import { resolveRequestExecutionPolicy, resolveRequestMetadata } from "../../src/server/request-policy.ts"
import {
  createRequestSecurityPolicy,
  validateRequestSecurityPolicy,
} from "../../src/server/request-security-policy.ts"

describe("request security policy", () => {
  test("derives trusted host from trusted origin", () => {
    const policy = createRequestSecurityPolicy({
      trustedOrigin: "https://app.example.com",
    })

    expect(policy.trustedHosts).toEqual(["app.example.com"])
    expect(policy.enforceTrustedHosts).toBe(false)
  })

  test("normalizes trusted forwarded hops when forwarded headers are trusted", () => {
    const policy = createRequestSecurityPolicy({
      trustForwardedHeaders: true,
      trustedForwardedHops: 3,
    })

    expect(policy.trustedForwardedHops).toBe(3)
  })

  test("rejects requests whose effective host falls outside trusted hosts", () => {
    const policy = createRequestSecurityPolicy({
      trustedOrigin: "https://app.example.com",
      trustForwardedHeaders: true,
      trustedHosts: ["app.example.com"],
    })
    const metadata = resolveRequestMetadata(new Request("http://localhost/dashboard", {
      headers: {
        Host: "localhost",
        "X-Forwarded-Host": "evil.example",
      },
    }), {
      kind: "page",
      trustForwardedHeaders: true,
      trustedOrigin: policy.trustedOrigin,
    })

    expect(
      validateRequestSecurityPolicy(metadata, resolveRequestExecutionPolicy("page"), policy)?.status,
    ).toBe(400)
  })

  test("rejects internal requests with foreign origin even on non-state-changing methods", () => {
    const policy = createRequestSecurityPolicy({
      trustedOrigin: "https://app.example.com",
    })
    const metadata = resolveRequestMetadata(new Request("https://app.example.com/dashboard", {
      headers: {
        Origin: "https://evil.example",
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    }), {
      kind: "partial",
      visibility: "internal",
      trustedOrigin: policy.trustedOrigin,
    })

    expect(
      validateRequestSecurityPolicy(metadata, resolveRequestExecutionPolicy("partial"), policy)?.status,
    ).toBe(403)
  })

  test("does not treat public document endpoints as internal-only", () => {
    const policy = createRequestSecurityPolicy({
      trustedOrigin: "https://app.example.com",
    })
    const metadata = resolveRequestMetadata(new Request("https://app.example.com/profile", {
      headers: {
        Origin: "https://evil.example",
      },
    }), {
      kind: "page",
      trustedOrigin: policy.trustedOrigin,
    })

    expect(
      validateRequestSecurityPolicy(metadata, resolveRequestExecutionPolicy("page"), policy),
    ).toBeNull()
  })
})
