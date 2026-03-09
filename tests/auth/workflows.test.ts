import { describe, expect, test } from "bun:test"
import {
  createAuth,
  createAuthActionTokenManager,
  createMemorySessionStore,
  createMemoryAuthActionTokenStore,
} from "../../src/auth/index.ts"
import { createContext } from "../../src/server/middleware.ts"

describe("auth workflows", () => {
  test("rotateSession replaces session id and preserves user identity", async () => {
    const auth = createAuth({ secret: "rotate-secret", maxAge: 3600 })
    const ctx = createContext(new Request("http://localhost/profile"))

    await auth.login(ctx, "user-1", { role: "admin", permissions: ["billing:write"] })
    const previous = auth.getSession(ctx)!
    await auth.rotateSession(ctx)
    const current = auth.getSession(ctx)!

    expect(current.userId).toBe("user-1")
    expect(current.data).toEqual(previous.data)
    expect(current.id).not.toBe(previous.id)
  })

  test("requirePermission uses session permissions", async () => {
    const auth = createAuth({ secret: "perm-secret", maxAge: 3600 })
    const allowed = createContext(new Request("http://localhost/admin"))
    await auth.login(allowed, "user-2", { permissions: ["org:invite"] })

    const response = await auth.requirePermission("org:invite")(allowed, async () => new Response("ok"))
    expect(response.status).toBe(200)

    const denied = createContext(new Request("http://localhost/admin"))
    await auth.login(denied, "user-3", { permissions: ["org:view"] })
    const deniedResponse = await auth.requirePermission("org:invite")(denied, async () => new Response("ok"))
    expect(deniedResponse.status).toBe(403)
  })

  test("requireRole and protectRole use auth-native role checks", async () => {
    const auth = createAuth({ secret: "role-secret", maxAge: 3600 })
    const allowed = createContext(new Request("http://localhost/admin"))
    await auth.login(allowed, "user-22", { role: "admin" })

    const roleResponse = await auth.requireRole("admin")(allowed, async () => new Response("ok"))
    expect(roleResponse.status).toBe(200)

    const denied = createContext(new Request("http://localhost/admin"))
    await auth.login(denied, "user-23", { role: "user" })
    const deniedRoleResponse = await auth.protectRole("admin")(denied, async () => new Response("ok"))
    expect(deniedRoleResponse.status).toBe(403)
  })

  test("permission resolver extends session permissions", async () => {
    const auth = createAuth({
      secret: "resolver-secret",
      permissionResolver: (session, permission) => session.userId === "root" && permission === "org:delete",
    })
    const ctx = createContext(new Request("http://localhost/root"))
    await auth.login(ctx, "root")

    expect(await auth.hasPermission(ctx, "org:delete")).toBe(true)
    expect(auth.hasRole(ctx, "admin")).toBe(false)
  })

  test("auth events emit login, rotate, logout, invalid-cookie and expired-session", async () => {
    const events: string[] = []
    const store = createMemorySessionStore()
    const auth = createAuth({
      secret: "event-secret",
      maxAge: 1,
      events(event) {
        events.push(event.type)
      },
      store,
    })

    const ctx = createContext(new Request("http://localhost/"))
    await auth.login(ctx, "user-4")
    await auth.rotateSession(ctx)

    const invalidCtx = createContext(new Request("http://localhost/", {
      headers: { Cookie: "gorsee_session=bad.value" },
    }))
    await auth.middleware(invalidCtx, async () => new Response("ok"))

    const expiringLoginCtx = createContext(new Request("http://localhost/"))
    await auth.login(expiringLoginCtx, "user-5")
    const cookie = expiringLoginCtx.responseHeaders.get("set-cookie")!.split(";")[0]!.split("=").slice(1).join("=")
    const expiringCtx = createContext(new Request("http://localhost/", {
      headers: { Cookie: `gorsee_session=${cookie}` },
    }))
    const session = auth.getSession(expiringLoginCtx)!
    session.expiresAt = Date.now() - 1
    await auth.middleware(expiringCtx, async () => new Response("ok"))
    await auth.logout(ctx)

    expect(events).toContain("login")
    expect(events).toContain("rotate")
    expect(events).toContain("invalid-cookie")
    expect(events).toContain("expired-session")
    expect(events).toContain("logout")
  })

  test("auth action tokens support magic link, password reset, and email verification flows", async () => {
    const manager = createAuthActionTokenManager({
      secret: "workflow-token-secret",
      store: createMemoryAuthActionTokenStore(),
    })

    const magicLink = await manager.issueMagicLink("user-1", "user@example.com", { tenant: "acme" })
    const reset = await manager.issuePasswordReset("user-1", "user@example.com")
    const verification = await manager.issueEmailVerification("user-1", "user@example.com")

    expect((await manager.verify(magicLink.token, { expectedPurpose: "magic-link" }))?.email).toBe("user@example.com")
    expect((await manager.consume(reset.token, { expectedPurpose: "password-reset" }))?.purpose).toBe("password-reset")
    expect(await manager.consume(reset.token, { expectedPurpose: "password-reset" })).toBeNull()
    expect((await manager.consume(verification.token, { expectedPurpose: "email-verification" }))?.subject).toBe("user-1")
  })
})
