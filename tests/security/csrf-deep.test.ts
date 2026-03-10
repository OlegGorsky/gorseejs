import { describe, test, expect } from "bun:test"
import {
  createCSRFMiddleware,
  generateCSRFToken,
  csrfProtection,
  validateCSRFToken,
} from "../../src/security/csrf.ts"
import { createContext } from "../../src/server/middleware.ts"

describe("CSRF deep", () => {
  test("generateCSRFToken returns hex string of 64 chars", () => {
    const token = generateCSRFToken()
    expect(token.length).toBe(64)
    expect(/^[0-9a-f]+$/.test(token)).toBe(true)
  })

  test("each generated token is unique", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateCSRFToken()))
    expect(tokens.size).toBe(20)
  })

  test("csrfProtection token and cookie are linked", async () => {
    const result = await csrfProtection("secret")
    const cookieValue = result.cookie.split("=")[1]!.split(";")[0]!
    expect(cookieValue).toContain(".")
    expect(cookieValue.startsWith(result.token)).toBe(true)
  })

  test("cookie contains SameSite=Lax", async () => {
    const result = await csrfProtection("secret")
    expect(result.cookie).toContain("SameSite=Lax")
  })

  test("cookie contains Secure flag", async () => {
    const result = await csrfProtection("secret")
    expect(result.cookie).toContain("Secure")
  })

  test("different secrets produce different signatures", async () => {
    const a = await csrfProtection("secret-a")
    const b = await csrfProtection("secret-b")
    const sigA = a.cookie.split("=")[1]!.split(";")[0]!.split(".")[1]
    const sigB = b.cookie.split("=")[1]!.split(";")[0]!.split(".")[1]
    expect(sigA).not.toBe(sigB)
  })

  test("validates correct POST with matching token", async () => {
    const secret = "test-secret"
    const csrf = await csrfProtection(secret)
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!
    const req = new Request("http://localhost/api", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${cookieValue}`,
        "x-gorsee-csrf": csrf.token,
      },
    })
    expect(await validateCSRFToken(req, secret)).toBe(true)
  })

  test("rejects POST with mismatched header token", async () => {
    const secret = "test-secret"
    const csrf = await csrfProtection(secret)
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!
    const req = new Request("http://localhost/api", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${cookieValue}`,
        "x-gorsee-csrf": "wrong-token",
      },
    })
    expect(await validateCSRFToken(req, secret)).toBe(false)
  })

  test("rejects POST with no header token", async () => {
    const csrf = await csrfProtection("secret")
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!
    const req = new Request("http://localhost/api", {
      method: "POST",
      headers: { cookie: `__gorsee_csrf=${cookieValue}` },
    })
    expect(await validateCSRFToken(req, "secret")).toBe(false)
  })

  test("rejects POST with no cookie", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      headers: { "x-gorsee-csrf": "some-token" },
    })
    expect(await validateCSRFToken(req, "secret")).toBe(false)
  })

  test("allows GET without any token", async () => {
    const req = new Request("http://localhost/api", { method: "GET" })
    expect(await validateCSRFToken(req, "secret")).toBe(true)
  })

  test("allows HEAD without any token", async () => {
    const req = new Request("http://localhost/api", { method: "HEAD" })
    expect(await validateCSRFToken(req, "secret")).toBe(true)
  })

  test("allows OPTIONS without any token", async () => {
    const req = new Request("http://localhost/api", { method: "OPTIONS" })
    expect(await validateCSRFToken(req, "secret")).toBe(true)
  })

  test("rejects POST with tampered signature", async () => {
    const csrf = await csrfProtection("secret")
    const tampered = csrf.token + ".tampered-signature"
    const req = new Request("http://localhost/api", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${tampered}`,
        "x-gorsee-csrf": csrf.token,
      },
    })
    expect(await validateCSRFToken(req, "secret")).toBe(false)
  })

  test("headerName is x-gorsee-csrf", async () => {
    const result = await csrfProtection("secret")
    expect(result.headerName).toBe("x-gorsee-csrf")
  })

  test("rotating the csrf cookie invalidates the previous header/cookie pair mix", async () => {
    const secret = "rotation-secret"
    const first = await csrfProtection(secret)
    const second = await csrfProtection(secret)
    const firstCookie = first.cookie.split("=")[1]!.split(";")[0]!
    const secondCookie = second.cookie.split("=")[1]!.split(";")[0]!

    const req = new Request("http://localhost/api", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${secondCookie}`,
        "x-gorsee-csrf": first.token,
      },
    })

    expect(firstCookie).not.toBe(secondCookie)
    expect(await validateCSRFToken(req, secret)).toBe(false)
  })

  test("createCSRFMiddleware allows safe methods without token material", async () => {
    const middleware = createCSRFMiddleware("secret")
    const ctx = createContext(new Request("http://localhost/api", { method: "GET" }))

    const response = await middleware(ctx, async () => new Response("ok"))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("ok")
  })

  test("createCSRFMiddleware rejects unsafe methods with stale rotated token material", async () => {
    const secret = "rotation-secret"
    const middleware = createCSRFMiddleware(secret)
    const first = await csrfProtection(secret)
    const second = await csrfProtection(secret)
    const secondCookie = second.cookie.split("=")[1]!.split(";")[0]!
    const ctx = createContext(new Request("http://localhost/api", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${secondCookie}`,
        "x-gorsee-csrf": first.token,
      },
    }))

    const response = await middleware(ctx, async () => new Response("ok"))

    expect(response.status).toBe(403)
    expect(await response.text()).toBe("Invalid CSRF token")
  })
})
