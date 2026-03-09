// Security vulnerability tests for auth, cookies, redirects, and sessions

import { describe, test, expect } from "bun:test"
import { createAuth, type AuthConfig } from "../../src/auth/index.ts"
import { createContext } from "../../src/server/middleware.ts"

const TEST_SECRET = "test-secret-key-for-vuln-tests-2024"

function makeRequest(url = "http://localhost:3000/", cookie?: string): Request {
  const headers: Record<string, string> = {}
  if (cookie) headers["cookie"] = cookie
  return new Request(url, { headers })
}

function makeConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return { secret: TEST_SECRET, ...overrides }
}

// ─── 1. Timing attack resistance in auth verify ─────────────────────────────

describe("Timing attack resistance", () => {
  test("invalid signature returns no session", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(
      makeRequest("http://localhost:3000/", "gorsee_session=fake-id.badsignature"),
    )
    const next = async () => new Response("ok")
    await auth.middleware(ctx, next)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("truncated signature returns no session", async () => {
    const auth = createAuth(makeConfig())
    // Login to get a real signed cookie
    const loginCtx = createContext(makeRequest())
    await auth.login(loginCtx, "user1")
    const setCookieHeader = loginCtx.responseHeaders.get("Set-Cookie")!
    const signedValue = setCookieHeader.split("=")[1]!.split(";")[0]!
    // Truncate the signature by half
    const truncated = signedValue.slice(0, Math.floor(signedValue.length / 2))

    const ctx = createContext(
      makeRequest("http://localhost:3000/", `gorsee_session=${truncated}`),
    )
    const next = async () => new Response("ok")
    await auth.middleware(ctx, next)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("signature with one bit changed returns no session", async () => {
    const auth = createAuth(makeConfig())
    const loginCtx = createContext(makeRequest())
    await auth.login(loginCtx, "user1")
    const setCookieHeader = loginCtx.responseHeaders.get("Set-Cookie")!
    const signedValue = setCookieHeader.split("=")[1]!.split(";")[0]!
    // Flip the last character of the signature
    const chars = signedValue.split("")
    const lastIdx = chars.length - 1
    const lastChar = chars[lastIdx]!
    chars[lastIdx] = lastChar === "a" ? "b" : "a"
    const flipped = chars.join("")

    const ctx = createContext(
      makeRequest("http://localhost:3000/", `gorsee_session=${flipped}`),
    )
    const next = async () => new Response("ok")
    await auth.middleware(ctx, next)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("empty string cookie returns no session", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(
      makeRequest("http://localhost:3000/", "gorsee_session="),
    )
    const next = async () => new Response("ok")
    await auth.middleware(ctx, next)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("cookie without dot separator returns no session", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(
      makeRequest("http://localhost:3000/", "gorsee_session=noseparatorhere"),
    )
    const next = async () => new Response("ok")
    await auth.middleware(ctx, next)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("valid signed cookie returns session", async () => {
    const auth = createAuth(makeConfig())
    const loginCtx = createContext(makeRequest())
    await auth.login(loginCtx, "user1")
    const setCookieHeader = loginCtx.responseHeaders.get("Set-Cookie")!
    const signedValue = setCookieHeader.split("=")[1]!.split(";")[0]!

    const ctx = createContext(
      makeRequest("http://localhost:3000/", `gorsee_session=${signedValue}`),
    )
    const next = async () => new Response("ok")
    await auth.middleware(ctx, next)
    const session = auth.getSession(ctx)
    expect(session).not.toBeNull()
    expect(session!.userId).toBe("user1")
  })
})

// ─── 2. Cookie injection prevention ─────────────────────────────────────────

describe("Cookie injection prevention", () => {
  test("strips \\r from cookie name", () => {
    const ctx = createContext(makeRequest())
    ctx.setCookie("bad\rname", "value")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    expect(header).not.toContain("\r")
    expect(header).toStartWith("badname=value")
  })

  test("strips \\n from cookie value", () => {
    const ctx = createContext(makeRequest())
    ctx.setCookie("name", "bad\nvalue")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    expect(header).not.toContain("\n")
    expect(header).toContain("name=badvalue")
  })

  test("strips semicolons from cookie name and value", () => {
    const ctx = createContext(makeRequest())
    ctx.setCookie("na;me", "val;ue")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    // The serialized cookie should not have injected attributes
    expect(header).toStartWith("name=value")
  })

  test("strips commas from cookie value", () => {
    const ctx = createContext(makeRequest())
    ctx.setCookie("name", "val,ue")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    expect(header).toContain("name=value")
  })

  test("strips CRLF from cookie value preventing header injection", () => {
    const ctx = createContext(makeRequest())
    ctx.setCookie("name", "value\r\ninjected")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    // \r and \n must be stripped — the value should be "valueinjected" without line breaks
    expect(header).not.toContain("\r")
    expect(header).not.toContain("\n")
    expect(header).toContain("name=valueinjected")
  })
})

// ─── 3. Open redirect prevention ────────────────────────────────────────────

describe("Open redirect prevention", () => {
  test("allows relative path /dashboard", () => {
    const ctx = createContext(makeRequest())
    const res = ctx.redirect("/dashboard")
    expect(res.headers.get("Location")).toBe("/dashboard")
    expect(res.status).toBe(302)
  })

  test("allows relative path with query string", () => {
    const ctx = createContext(makeRequest())
    const res = ctx.redirect("/search?q=test")
    expect(res.headers.get("Location")).toBe("/search?q=test")
  })

  test("blocks external URL https://evil.com", () => {
    const ctx = createContext(makeRequest())
    const res = ctx.redirect("https://evil.com")
    expect(res.headers.get("Location")).toBe("/")
  })

  test("blocks protocol-relative URL //evil.com", () => {
    const ctx = createContext(makeRequest())
    const res = ctx.redirect("//evil.com")
    expect(res.headers.get("Location")).toBe("/")
  })

  test("blocks javascript: protocol", () => {
    const ctx = createContext(makeRequest())
    const res = ctx.redirect("javascript:alert(1)")
    expect(res.headers.get("Location")).toBe("/")
  })

  test("blocks data: protocol", () => {
    const ctx = createContext(makeRequest())
    const res = ctx.redirect("data:text/html,<h1>evil</h1>")
    expect(res.headers.get("Location")).toBe("/")
  })

  test("allows same-origin absolute URL", () => {
    const ctx = createContext(makeRequest("http://localhost:3000/"))
    const res = ctx.redirect("http://localhost:3000/safe")
    expect(res.headers.get("Location")).toBe("http://localhost:3000/safe")
  })

  test("falls back to / for blocked redirect", () => {
    const ctx = createContext(makeRequest())
    const res = ctx.redirect("https://attacker.io/phish")
    expect(res.headers.get("Location")).toBe("/")
  })
})

// ─── 4. Session security ────────────────────────────────────────────────────

describe("Session security", () => {
  test("session cookie has httpOnly flag", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(makeRequest())
    await auth.login(ctx, "user1")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    expect(header).toContain("HttpOnly")
  })

  test("session cookie has SameSite=Lax", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(makeRequest())
    await auth.login(ctx, "user1")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    expect(header).toContain("SameSite=Lax")
  })

  test("session cookie has Path=/", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(makeRequest())
    await auth.login(ctx, "user1")
    const header = ctx.responseHeaders.get("Set-Cookie")!
    expect(header).toContain("Path=/")
  })

  test("expired sessions are rejected", async () => {
    // Use a very short maxAge (1 second)
    const auth = createAuth(makeConfig({ maxAge: 0 }))
    const loginCtx = createContext(makeRequest())
    await auth.login(loginCtx, "user1")
    const setCookieHeader = loginCtx.responseHeaders.get("Set-Cookie")!
    const signedValue = setCookieHeader.split("=")[1]!.split(";")[0]!

    // Wait a tick for expiration (maxAge=0 means expiresAt = Date.now())
    await new Promise((r) => setTimeout(r, 10))

    const ctx = createContext(
      makeRequest("http://localhost:3000/", `gorsee_session=${signedValue}`),
    )
    const next = async () => new Response("ok")
    await auth.middleware(ctx, next)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("invalid session ID (not in store) is rejected", async () => {
    const auth = createAuth(makeConfig())
    // Create a validly signed cookie but with a UUID that is not in the session store
    const loginCtx = createContext(makeRequest())
    await auth.login(loginCtx, "user1")
    // Logout to remove from store
    await auth.logout(loginCtx)

    // Get the original signed session cookie (first Set-Cookie before logout)
    const allHeaders = [...loginCtx.responseHeaders.entries()]
    const sessionCookie = allHeaders
      .filter(([k]) => k === "set-cookie")
      .map(([, v]) => v)
      .find((v) => v.includes("gorsee_session=") && !v.includes("Max-Age=0"))

    // Even if we had the signed cookie, session ID was removed from store
    if (sessionCookie) {
      const signedValue = sessionCookie.split("=")[1]!.split(";")[0]!
      const ctx = createContext(
        makeRequest("http://localhost:3000/", `gorsee_session=${signedValue}`),
      )
      const next = async () => new Response("ok")
      await auth.middleware(ctx, next)
      expect(auth.getSession(ctx)).toBeNull()
    }
  })

  test("session data isolation between users", async () => {
    const auth = createAuth(makeConfig())

    // Login user A
    const ctxA = createContext(makeRequest())
    await auth.login(ctxA, "userA", { role: "admin" })
    const headerA = ctxA.responseHeaders.get("Set-Cookie")!
    const signedA = headerA.split("=")[1]!.split(";")[0]!

    // Login user B
    const ctxB = createContext(makeRequest())
    await auth.login(ctxB, "userB", { role: "viewer" })
    const headerB = ctxB.responseHeaders.get("Set-Cookie")!
    const signedB = headerB.split("=")[1]!.split(";")[0]!

    // Verify A sees only A's data
    const verifyA = createContext(
      makeRequest("http://localhost:3000/", `gorsee_session=${signedA}`),
    )
    await auth.middleware(verifyA, async () => new Response("ok"))
    const sessionA = auth.getSession(verifyA)
    expect(sessionA!.userId).toBe("userA")
    expect(sessionA!.data.role).toBe("admin")

    // Verify B sees only B's data
    const verifyB = createContext(
      makeRequest("http://localhost:3000/", `gorsee_session=${signedB}`),
    )
    await auth.middleware(verifyB, async () => new Response("ok"))
    const sessionB = auth.getSession(verifyB)
    expect(sessionB!.userId).toBe("userB")
    expect(sessionB!.data.role).toBe("viewer")

    // A's cookie cannot access B's session
    expect(sessionA!.id).not.toBe(sessionB!.id)
  })

  test("logout clears session from store", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(makeRequest())
    await auth.login(ctx, "user1")
    expect(auth.getSession(ctx)).not.toBeNull()

    await auth.logout(ctx)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("logout sets cookie Max-Age=0", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(makeRequest())
    await auth.login(ctx, "user1")
    await auth.logout(ctx)

    const allCookies = ctx.responseHeaders.getSetCookie()
    const deleteCookie = allCookies.find((c) => c.includes("Max-Age=0"))
    expect(deleteCookie).toBeDefined()
  })
})

// ─── 5. Session ID cryptographic quality ────────────────────────────────────

describe("Session ID cryptographic quality", () => {
  test("session ID is UUID format", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(makeRequest())
    await auth.login(ctx, "user1")
    const session = auth.getSession(ctx)
    expect(session).not.toBeNull()
    // crypto.randomUUID() produces v4 UUIDs: 8-4-4-4-12 hex
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    expect(session!.id).toMatch(uuidPattern)
  })

  test("session IDs are unique across multiple logins", async () => {
    const auth = createAuth(makeConfig())
    const ids = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const ctx = createContext(makeRequest())
      await auth.login(ctx, `user${i}`)
      const session = auth.getSession(ctx)
      ids.add(session!.id)
    }
    // All 20 IDs must be unique
    expect(ids.size).toBe(20)
  })

  test("session ID appears in signed cookie value", async () => {
    const auth = createAuth(makeConfig())
    const ctx = createContext(makeRequest())
    await auth.login(ctx, "user1")
    const session = auth.getSession(ctx)!
    const header = ctx.responseHeaders.get("Set-Cookie")!
    const signedValue = header.split("=")[1]!.split(";")[0]!
    // The signed value should be sessionId.signature
    expect(signedValue).toStartWith(session.id + ".")
  })
})
