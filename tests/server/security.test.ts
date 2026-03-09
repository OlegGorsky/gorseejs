import { describe, test, expect } from "bun:test"
import { securityHeaders } from "../../src/security/headers.ts"
import { generateCSRFToken, csrfProtection, validateCSRFToken } from "../../src/security/csrf.ts"
import { createRateLimiter } from "../../src/security/rate-limit.ts"

describe("securityHeaders", () => {
  test("returns all default headers", () => {
    const headers = securityHeaders()
    expect(headers["Content-Security-Policy"]).toBeDefined()
    expect(headers["Strict-Transport-Security"]).toBeDefined()
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["X-Frame-Options"]).toBe("DENY")
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
  })

  test("CSP includes self by default", () => {
    const headers = securityHeaders()
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'")
    expect(headers["Content-Security-Policy"]).toContain("script-src 'self'")
  })

  test("CSP includes nonce when provided", () => {
    const headers = securityHeaders({}, "abc123")
    expect(headers["Content-Security-Policy"]).toContain("'nonce-abc123'")
  })

  test("can disable CSP", () => {
    const headers = securityHeaders({ csp: false })
    expect(headers["Content-Security-Policy"]).toBeUndefined()
  })

  test("can disable HSTS", () => {
    const headers = securityHeaders({ hsts: false })
    expect(headers["Strict-Transport-Security"]).toBeUndefined()
  })

  test("always includes X-Content-Type-Options", () => {
    const headers = securityHeaders({ csp: false, hsts: false })
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
  })
})

describe("CSRF", () => {
  test("generateCSRFToken returns string", () => {
    const token = generateCSRFToken()
    expect(typeof token).toBe("string")
    expect(token.length).toBe(64) // 32 bytes hex encoded
  })

  test("tokens are unique", () => {
    const t1 = generateCSRFToken()
    const t2 = generateCSRFToken()
    expect(t1).not.toBe(t2)
  })

  test("csrfProtection generates token and signed cookie", async () => {
    const result = await csrfProtection("test-secret")
    expect(result.token).toBeDefined()
    expect(result.cookie).toContain("__gorsee_csrf=")
    expect(result.cookie).toContain(".")  // token.signature
    expect(result.headerName).toBe("x-gorsee-csrf")
  })

  test("validates correct token", async () => {
    const secret = "my-secret"
    const csrf = await csrfProtection(secret)

    // Extract token.signature from cookie
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!

    const request = new Request("http://localhost/api/data", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${cookieValue}`,
        "x-gorsee-csrf": csrf.token,
      },
    })

    const valid = await validateCSRFToken(request, secret)
    expect(valid).toBe(true)
  })

  test("rejects wrong token", async () => {
    const secret = "my-secret"
    const csrf = await csrfProtection(secret)
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!

    const request = new Request("http://localhost/api/data", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${cookieValue}`,
        "x-gorsee-csrf": "wrong-token",
      },
    })

    const valid = await validateCSRFToken(request, secret)
    expect(valid).toBe(false)
  })

  test("skips GET requests", async () => {
    const request = new Request("http://localhost/api/data", { method: "GET" })
    const valid = await validateCSRFToken(request, "secret")
    expect(valid).toBe(true)
  })
})

describe("rateLimiter", () => {
  test("allows requests within limit", () => {
    const limiter = createRateLimiter(3, "1m")
    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(true)
  })

  test("blocks requests over limit", () => {
    const limiter = createRateLimiter(2, "1m")
    limiter.check("user1")
    limiter.check("user1")
    const result = limiter.check("user1")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  test("different keys are independent", () => {
    const limiter = createRateLimiter(1, "1m")
    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user2").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(false)
    expect(limiter.check("user2").allowed).toBe(false)
  })

  test("returns remaining count", () => {
    const limiter = createRateLimiter(5, "1m")
    expect(limiter.check("user1").remaining).toBe(4)
    expect(limiter.check("user1").remaining).toBe(3)
    expect(limiter.check("user1").remaining).toBe(2)
  })

  test("reset clears bucket", () => {
    const limiter = createRateLimiter(1, "1m")
    limiter.check("user1")
    expect(limiter.check("user1").allowed).toBe(false)
    limiter.reset("user1")
    expect(limiter.check("user1").allowed).toBe(true)
  })

  test("parses time windows", () => {
    // Should not throw
    createRateLimiter(10, "30s")
    createRateLimiter(10, "5m")
    createRateLimiter(10, "1h")
  })

  test("rejects invalid window", () => {
    expect(() => createRateLimiter(10, "invalid")).toThrow("Invalid rate limit window")
  })
})
