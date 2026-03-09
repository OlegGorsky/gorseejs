import { describe, it, expect } from "bun:test"
import { createAuth } from "../../src/auth/index.ts"
import { createContext } from "../../src/server/middleware.ts"

describe("createAuth", () => {
  const auth = createAuth({ secret: "test-secret-key-123", maxAge: 3600 })

  it("login creates session and sets cookie", async () => {
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "user-1", { role: "admin" })
    const session = auth.getSession(ctx)
    expect(session).not.toBeNull()
    expect(session!.userId).toBe("user-1")
    expect(session!.data.role).toBe("admin")
    // Cookie should be set
    const setCookie = ctx.responseHeaders.get("set-cookie")
    expect(setCookie).toContain("gorsee_session=")
    expect(setCookie).toContain("HttpOnly")
  })

  it("middleware parses session from signed cookie", async () => {
    // Login to get a signed cookie
    const loginCtx = createContext(new Request("http://localhost/"))
    await auth.login(loginCtx, "user-2")
    const setCookie = loginCtx.responseHeaders.get("set-cookie")!
    const cookieValue = setCookie.split(";")[0]!.split("=").slice(1).join("=")

    // Use that cookie in a new request
    const req = new Request("http://localhost/dashboard", {
      headers: { Cookie: `gorsee_session=${cookieValue}` },
    })
    const ctx = createContext(req)
    await auth.middleware(ctx, async () => new Response("OK"))
    const session = auth.getSession(ctx)
    expect(session).not.toBeNull()
    expect(session!.userId).toBe("user-2")
  })

  it("requireAuth redirects when no session", async () => {
    const ctx = createContext(new Request("http://localhost/protected"))
    const res = await auth.requireAuth(ctx, async () => new Response("OK"))
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/login")
  })

  it("requireAuth passes when session exists", async () => {
    const ctx = createContext(new Request("http://localhost/protected"))
    await auth.login(ctx, "user-3")
    const res = await auth.requireAuth(ctx, async () => new Response("Protected content"))
    expect(res.status).toBe(200)
  })

  it("protect composes session restore and auth gate", async () => {
    const loginCtx = createContext(new Request("http://localhost/"))
    await auth.login(loginCtx, "user-33")
    const cookieValue = loginCtx.responseHeaders.get("set-cookie")!.split(";")[0]!.split("=").slice(1).join("=")

    const ctx = createContext(new Request("http://localhost/protected", {
      headers: { Cookie: `gorsee_session=${cookieValue}` },
    }))
    const res = await auth.protect()(ctx, async () => new Response("Protected content"))

    expect(res.status).toBe(200)
    expect(auth.getSession(ctx)?.userId).toBe("user-33")
  })

  it("logout destroys session", async () => {
    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "user-4")
    expect(auth.getSession(ctx)).not.toBeNull()
    await auth.logout(ctx)
    expect(auth.getSession(ctx)).toBeNull()
  })
})
