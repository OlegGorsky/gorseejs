import { describe, test, expect } from "bun:test"
import {
  createContext,
  runMiddlewareChain,
  middleware,
  type MiddlewareFn,
} from "../../src/server/middleware.ts"

describe("createContext", () => {
  test("parses cookies", () => {
    const req = new Request("http://localhost/", {
      headers: { cookie: "session=abc123; theme=dark" },
    })
    const ctx = createContext(req)
    expect(ctx.cookies.get("session")).toBe("abc123")
    expect(ctx.cookies.get("theme")).toBe("dark")
  })

  test("parses URL", () => {
    const req = new Request("http://localhost/users?page=2")
    const ctx = createContext(req)
    expect(ctx.url.pathname).toBe("/users")
    expect(ctx.url.searchParams.get("page")).toBe("2")
  })

  test("sets params", () => {
    const req = new Request("http://localhost/users/42")
    const ctx = createContext(req, { id: "42" })
    expect(ctx.params.id).toBe("42")
  })

  test("redirect returns Response with Location", () => {
    const req = new Request("http://localhost/")
    const ctx = createContext(req)
    const res = ctx.redirect("/login")
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/login")
  })
})

describe("runMiddlewareChain", () => {
  test("runs handler when no middleware", async () => {
    const req = new Request("http://localhost/")
    const ctx = createContext(req)

    const res = await runMiddlewareChain([], ctx, async () => {
      return new Response("ok")
    })

    expect(await res.text()).toBe("ok")
  })

  test("middleware can modify ctx.locals", async () => {
    const req = new Request("http://localhost/")
    const ctx = createContext(req)

    const authMiddleware = middleware(async (ctx, next) => {
      ctx.locals.user = "Alice"
      return next()
    })

    const res = await runMiddlewareChain([authMiddleware], ctx, async () => {
      return new Response(`Hello ${ctx.locals.user}`)
    })

    expect(await res.text()).toBe("Hello Alice")
  })

  test("middleware can short-circuit", async () => {
    const req = new Request("http://localhost/admin")
    const ctx = createContext(req)

    const guardMiddleware = middleware(async (ctx, _next) => {
      return ctx.redirect("/login")
    })

    const res = await runMiddlewareChain([guardMiddleware], ctx, async () => {
      return new Response("should not reach")
    })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/login")
  })

  test("middleware chain runs in order", async () => {
    const req = new Request("http://localhost/")
    const ctx = createContext(req)
    const order: string[] = []

    const mw1 = middleware(async (_ctx, next) => {
      order.push("mw1:before")
      const res = await next()
      order.push("mw1:after")
      return res
    })

    const mw2 = middleware(async (_ctx, next) => {
      order.push("mw2:before")
      const res = await next()
      order.push("mw2:after")
      return res
    })

    await runMiddlewareChain([mw1, mw2], ctx, async () => {
      order.push("handler")
      return new Response("ok")
    })

    expect(order).toEqual(["mw1:before", "mw2:before", "handler", "mw2:after", "mw1:after"])
  })
})
