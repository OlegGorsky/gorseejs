import { describe, test, expect } from "bun:test"
import {
  createGuard,
  requireAuth,
  requireRole,
  allGuards,
  anyGuard,
} from "../../src/server/guard.ts"
import { createContext } from "../../src/server/middleware.ts"

const ok = async () => new Response("OK", { status: 200 })
function makeCtx(url = "http://localhost/") {
  return createContext(new Request(url))
}

describe("createGuard", () => {
  test("passes when check returns true", async () => {
    const g = createGuard(() => true)
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(200)
  })

  test("blocks when check returns false", async () => {
    const g = createGuard(() => false)
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(403)
    expect(await res.text()).toBe("Forbidden")
  })

  test("custom onFail with redirect", async () => {
    const g = createGuard(() => false, {
      onFail: (ctx) => ctx.redirect("/denied", 307),
    })
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(307)
    expect(res.headers.get("Location")).toBe("/denied")
  })

  test("custom status code via onFail", async () => {
    const g = createGuard(() => false, {
      onFail: () => new Response("Unauthorized", { status: 401 }),
    })
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(401)
  })

  test("async check function works", async () => {
    const g = createGuard(async () => {
      await Promise.resolve()
      return true
    })
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(200)
  })

  test("async check returning false blocks", async () => {
    const g = createGuard(async () => false)
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(403)
  })
})

describe("requireAuth", () => {
  test("redirects to /login when no session", async () => {
    const g = requireAuth()
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/login")
  })

  test("redirects to custom path", async () => {
    const g = requireAuth("/signin")
    const res = await g(makeCtx(), ok)
    expect(res.headers.get("Location")).toBe("/signin")
  })

  test("passes with session present", async () => {
    const g = requireAuth()
    const ctx = makeCtx()
    ctx.locals.session = { userId: "123" }
    const res = await g(ctx, ok)
    expect(res.status).toBe(200)
  })
})

describe("requireRole", () => {
  test("passes with correct role", async () => {
    const g = requireRole("admin")
    const ctx = makeCtx()
    ctx.locals.session = { data: { role: "admin" } }
    const res = await g(ctx, ok)
    expect(res.status).toBe(200)
  })

  test("blocks with wrong role", async () => {
    const g = requireRole("admin")
    const ctx = makeCtx()
    ctx.locals.session = { data: { role: "user" } }
    const res = await g(ctx, ok)
    expect(res.status).toBe(403)
  })

  test("blocks with no session", async () => {
    const g = requireRole("admin")
    const res = await g(makeCtx(), ok)
    expect(res.status).toBe(403)
  })

  test("custom onFail for requireRole", async () => {
    const g = requireRole("superadmin", {
      onFail: () => new Response("Nope", { status: 401 }),
    })
    const ctx = makeCtx()
    ctx.locals.session = { data: { role: "user" } }
    const res = await g(ctx, ok)
    expect(res.status).toBe(401)
  })
})

describe("allGuards", () => {
  test("all pass -> request proceeds", async () => {
    const combined = allGuards(createGuard(() => true), createGuard(() => true))
    const res = await combined(makeCtx(), ok)
    expect(res.status).toBe(200)
  })

  test("one fails -> blocked", async () => {
    const combined = allGuards(createGuard(() => true), createGuard(() => false))
    const res = await combined(makeCtx(), ok)
    expect(res.status).toBe(403)
  })

  test("first fails -> rest not checked", async () => {
    let secondChecked = false
    const g2 = createGuard(() => { secondChecked = true; return true })
    const combined = allGuards(createGuard(() => false), g2)
    await combined(makeCtx(), ok)
    expect(secondChecked).toBe(false)
  })
})

describe("anyGuard", () => {
  test("one passes -> request proceeds", async () => {
    const combined = anyGuard(createGuard(() => false), createGuard(() => true))
    const res = await combined(makeCtx(), ok)
    expect(res.status).toBe(200)
  })

  test("all fail -> blocked with 403", async () => {
    const combined = anyGuard(createGuard(() => false), createGuard(() => false))
    const res = await combined(makeCtx(), ok)
    expect(res.status).toBe(403)
  })

  test("first passes -> short circuits", async () => {
    let secondChecked = false
    const g2 = createGuard(() => { secondChecked = true; return false })
    const combined = anyGuard(createGuard(() => true), g2)
    await combined(makeCtx(), ok)
    expect(secondChecked).toBe(false)
  })
})
