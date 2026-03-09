import { describe, test, expect } from "bun:test"
import { securityHeaders } from "../../src/security/headers.ts"

describe("securityHeaders deep", () => {
  test("default headers include CSP", () => {
    const h = securityHeaders()
    expect(h["Content-Security-Policy"]).toBeDefined()
  })

  test("CSP includes nonce when provided", () => {
    const h = securityHeaders({}, "my-nonce-123")
    expect(h["Content-Security-Policy"]).toContain("nonce-my-nonce-123")
  })

  test("CSP script-src has nonce value", () => {
    const h = securityHeaders({}, "abc")
    expect(h["Content-Security-Policy"]).toContain("script-src 'nonce-abc'")
  })

  test("CSP script-src defaults to self without nonce", () => {
    const h = securityHeaders()
    expect(h["Content-Security-Policy"]).toContain("script-src 'self'")
  })

  test("X-Content-Type-Options is nosniff", () => {
    expect(securityHeaders()["X-Content-Type-Options"]).toBe("nosniff")
  })

  test("X-Frame-Options is DENY", () => {
    expect(securityHeaders()["X-Frame-Options"]).toBe("DENY")
  })

  test("Strict-Transport-Security present by default", () => {
    expect(securityHeaders()["Strict-Transport-Security"]).toBeDefined()
  })

  test("HSTS max-age >= 1 year (31536000)", () => {
    const hsts = securityHeaders()["Strict-Transport-Security"]!
    const match = hsts.match(/max-age=(\d+)/)
    expect(match).not.toBeNull()
    expect(Number(match![1])).toBeGreaterThanOrEqual(31536000)
  })

  test("HSTS includes includeSubDomains", () => {
    const hsts = securityHeaders()["Strict-Transport-Security"]!
    expect(hsts).toContain("includeSubDomains")
  })

  test("HSTS includes preload", () => {
    const hsts = securityHeaders()["Strict-Transport-Security"]!
    expect(hsts).toContain("preload")
  })

  test("X-XSS-Protection header is set", () => {
    expect(securityHeaders()["X-XSS-Protection"]).toBeDefined()
  })

  test("X-XSS-Protection is 0 (CSP preferred)", () => {
    expect(securityHeaders()["X-XSS-Protection"]).toBe("0")
  })

  test("Referrer-Policy is strict-origin-when-cross-origin", () => {
    expect(securityHeaders()["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
  })

  test("Permissions-Policy is present", () => {
    expect(securityHeaders()["Permissions-Policy"]).toBeDefined()
  })

  test("CSP frame-ancestors is none", () => {
    const csp = securityHeaders()["Content-Security-Policy"]!
    expect(csp).toContain("frame-ancestors 'none'")
  })

  test("all header values are strings", () => {
    const h = securityHeaders()
    for (const [, value] of Object.entries(h)) {
      expect(typeof value).toBe("string")
    }
  })

  test("no empty header values", () => {
    const h = securityHeaders()
    for (const [, value] of Object.entries(h)) {
      expect(value.length).toBeGreaterThan(0)
    }
  })

  test("headers without CSP and HSTS still have base headers", () => {
    const h = securityHeaders({ csp: false, hsts: false })
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
    expect(h["X-Frame-Options"]).toBe("DENY")
    expect(h["Referrer-Policy"]).toBeDefined()
    expect(h["Content-Security-Policy"]).toBeUndefined()
    expect(h["Strict-Transport-Security"]).toBeUndefined()
  })
})
