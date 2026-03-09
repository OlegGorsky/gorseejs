import { describe, test, expect } from "bun:test"
import { createAuth } from "../../src/auth/index.ts"
import { createContext } from "../../src/server/middleware.ts"

const SECRET = "deep-test-secret-key-256"

function freshAuth(overrides: Record<string, unknown> = {}) {
  return createAuth({ secret: SECRET, maxAge: 3600, ...overrides })
}

describe("auth deep", () => {
  test("createAuth returns all expected methods", () => {
    const auth = freshAuth()
    expect(typeof auth.middleware).toBe("function")
    expect(typeof auth.requireAuth).toBe("function")
    expect(typeof auth.requireRole).toBe("function")
    expect(typeof auth.protect).toBe("function")
    expect(typeof auth.protectRole).toBe("function")
    expect(typeof auth.protectPermission).toBe("function")
    expect(typeof auth.login).toBe("function")
    expect(typeof auth.logout).toBe("function")
    expect(typeof auth.getSession).toBe("function")
  })

  test("login sets session on ctx.locals", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u1", { role: "editor" })
    const session = auth.getSession(ctx)
    expect(session).not.toBeNull()
    expect(session!.userId).toBe("u1")
    expect(session!.data.role).toBe("editor")
  })

  test("login sets cookie in responseHeaders", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u2")
    const cookie = ctx.responseHeaders.get("set-cookie")
    expect(cookie).toContain("gorsee_session=")
  })

  test("cookie is HttpOnly", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u3")
    const cookie = ctx.responseHeaders.get("set-cookie")!
    expect(cookie).toContain("HttpOnly")
  })

  test("cookie is SameSite=Lax", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u4")
    const cookie = ctx.responseHeaders.get("set-cookie")!
    expect(cookie).toContain("SameSite=Lax")
  })

  test("cookie contains signature (has dot separator)", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u5")
    const cookie = ctx.responseHeaders.get("set-cookie")!
    const value = cookie.split(";")[0]!.split("=").slice(1).join("=")
    expect(value).toContain(".")
  })

  test("session has id, userId, data, expiresAt", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u6", { x: 1 })
    const s = auth.getSession(ctx)!
    expect(s.id).toBeDefined()
    expect(s.userId).toBe("u6")
    expect(s.data).toEqual({ x: 1 })
    expect(s.expiresAt).toBeGreaterThan(Date.now())
  })

  test("getSession returns null without login", () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("middleware restores session from valid cookie", async () => {
    const auth = freshAuth()
    const loginCtx = createContext(new Request("http://localhost/"))
    await auth.login(loginCtx, "u7")
    const cookieVal = extractCookieValue(loginCtx)

    const ctx = createContext(
      new Request("http://localhost/", {
        headers: { Cookie: `gorsee_session=${cookieVal}` },
      }),
    )
    await auth.middleware(ctx, async () => new Response("OK"))
    expect(auth.getSession(ctx)?.userId).toBe("u7")
  })

  test("middleware ignores invalid cookie signature", async () => {
    const auth = freshAuth()
    const ctx = createContext(
      new Request("http://localhost/", {
        headers: { Cookie: "gorsee_session=invalid.signature" },
      }),
    )
    await auth.middleware(ctx, async () => new Response("OK"))
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("logout clears session from ctx", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u8")
    expect(auth.getSession(ctx)).not.toBeNull()
    await auth.logout(ctx)
    expect(auth.getSession(ctx)).toBeNull()
  })

  test("logout sets expired cookie", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u9")
    await auth.logout(ctx)
    const cookies = ctx.responseHeaders.get("set-cookie")!
    expect(cookies).toContain("Max-Age=0")
  })

  test("requireAuth redirects without session", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/protected"))
    const res = await auth.requireAuth(ctx, async () => new Response("OK"))
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/login")
  })

  test("requireAuth passes with valid session", async () => {
    const auth = freshAuth()
    const ctx = createContext(new Request("http://localhost/protected"))
    await auth.login(ctx, "u10")
    const res = await auth.requireAuth(ctx, async () => new Response("allowed"))
    expect(res.status).toBe(200)
  })

  test("custom loginPath for requireAuth redirect", async () => {
    const auth = createAuth({ secret: SECRET, loginPath: "/signin" })
    const ctx = createContext(new Request("http://localhost/"))
    const res = await auth.requireAuth(ctx, async () => new Response("OK"))
    expect(res.headers.get("Location")).toBe("/signin")
  })

  test("protect redirects anonymous requests using auth middleware chain", async () => {
    const auth = createAuth({ secret: SECRET, loginPath: "/signin" })
    const ctx = createContext(new Request("http://localhost/protected"))
    const res = await auth.protect()(ctx, async () => new Response("OK"))
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/signin")
  })

  test("custom cookieName", async () => {
    const auth = createAuth({ secret: SECRET, cookieName: "my_sess" })
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "u11")
    const cookie = ctx.responseHeaders.get("set-cookie")!
    expect(cookie).toContain("my_sess=")
  })

  test("session expiresAt respects maxAge", async () => {
    const auth = createAuth({ secret: SECRET, maxAge: 60 })
    const ctx = createContext(new Request("http://localhost/"))
    const before = Date.now()
    await auth.login(ctx, "u12")
    const s = auth.getSession(ctx)!
    expect(s.expiresAt).toBeGreaterThanOrEqual(before + 60_000)
    expect(s.expiresAt).toBeLessThanOrEqual(Date.now() + 60_000 + 100)
  })

  test("multiple logins create separate sessions", async () => {
    const auth = freshAuth()
    const ctx1 = createContext(new Request("http://localhost/"))
    const ctx2 = createContext(new Request("http://localhost/"))
    await auth.login(ctx1, "user-a")
    await auth.login(ctx2, "user-b")
    expect(auth.getSession(ctx1)!.id).not.toBe(auth.getSession(ctx2)!.id)
  })

  test("session data is persisted", async () => {
    const auth = freshAuth()
    const loginCtx = createContext(new Request("http://localhost/"))
    await auth.login(loginCtx, "u13", { theme: "dark", lang: "ru" })
    const cookieVal = extractCookieValue(loginCtx)

    const ctx = createContext(
      new Request("http://localhost/", {
        headers: { Cookie: `gorsee_session=${cookieVal}` },
      }),
    )
    await auth.middleware(ctx, async () => new Response("OK"))
    const s = auth.getSession(ctx)!
    expect(s.data.theme).toBe("dark")
    expect(s.data.lang).toBe("ru")
  })
})

function extractCookieValue(ctx: { responseHeaders: Headers }): string {
  return ctx.responseHeaders
    .get("set-cookie")!
    .split(";")[0]!
    .split("=")
    .slice(1)
    .join("=")
}
