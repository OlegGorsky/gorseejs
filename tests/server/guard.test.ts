import { describe, it, expect } from "bun:test"
import { createGuard, requireRole, allGuards, anyGuard } from "../../src/server/guard.ts"
import { createContext } from "../../src/server/middleware.ts"

describe("createGuard", () => {
  it("allows when predicate returns true", async () => {
    const guard = createGuard(() => true)
    const ctx = createContext(new Request("http://localhost/"))
    const res = await guard(ctx, async () => new Response("OK"))
    expect(res.status).toBe(200)
  })

  it("blocks when predicate returns false", async () => {
    const guard = createGuard(() => false)
    const ctx = createContext(new Request("http://localhost/"))
    const res = await guard(ctx, async () => new Response("OK"))
    expect(res.status).toBe(403)
  })

  it("uses custom onFail handler", async () => {
    const guard = createGuard(() => false, {
      onFail: () => new Response("Custom denied", { status: 401 }),
    })
    const ctx = createContext(new Request("http://localhost/"))
    const res = await guard(ctx, async () => new Response("OK"))
    expect(res.status).toBe(401)
    expect(await res.text()).toBe("Custom denied")
  })
})

describe("requireRole", () => {
  it("allows matching role", async () => {
    const guard = requireRole("admin")
    const ctx = createContext(new Request("http://localhost/"))
    ctx.locals.session = { data: { role: "admin" } }
    const res = await guard(ctx, async () => new Response("OK"))
    expect(res.status).toBe(200)
  })

  it("blocks non-matching role", async () => {
    const guard = requireRole("admin")
    const ctx = createContext(new Request("http://localhost/"))
    ctx.locals.session = { data: { role: "user" } }
    const res = await guard(ctx, async () => new Response("OK"))
    expect(res.status).toBe(403)
  })
})

describe("allGuards", () => {
  it("passes only if all guards pass", async () => {
    const g1 = createGuard(() => true)
    const g2 = createGuard(() => false)
    const combined = allGuards(g1, g2)
    const ctx = createContext(new Request("http://localhost/"))
    const res = await combined(ctx, async () => new Response("OK"))
    expect(res.status).toBe(403)
  })
})

describe("anyGuard", () => {
  it("passes if any guard passes", async () => {
    const g1 = createGuard(() => false)
    const g2 = createGuard(() => true)
    const combined = anyGuard(g1, g2)
    const ctx = createContext(new Request("http://localhost/"))
    const res = await combined(ctx, async () => new Response("OK"))
    expect(res.status).toBe(200)
  })

  it("blocks if all guards fail", async () => {
    const g1 = createGuard(() => false)
    const g2 = createGuard(() => false)
    const combined = anyGuard(g1, g2)
    const ctx = createContext(new Request("http://localhost/"))
    const res = await combined(ctx, async () => new Response("OK"))
    expect(res.status).toBe(403)
  })
})
