import { describe, test, expect } from "bun:test"
import {
  createContext,
  runMiddlewareChain,
  redirect,
  RedirectError,
  type MiddlewareFn,
} from "../../src/server/middleware.ts"

function makeCtx(url = "http://localhost/") {
  return createContext(new Request(url))
}

const ok = async () => new Response("ok")

describe("runMiddlewareChain single middleware", () => {
  test("single middleware passes through to handler", async () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const ctx = makeCtx()
    const res = await runMiddlewareChain([mw], ctx, ok)
    expect(await res.text()).toBe("ok")
  })

  test("single middleware can short-circuit", async () => {
    const mw: MiddlewareFn = async () => new Response("blocked", { status: 403 })
    const ctx = makeCtx()
    const res = await runMiddlewareChain([mw], ctx, ok)
    expect(res.status).toBe(403)
    expect(await res.text()).toBe("blocked")
  })
})

describe("runMiddlewareChain multiple middleware", () => {
  test("multiple middleware run in order", async () => {
    const order: number[] = []
    const mws: MiddlewareFn[] = [1, 2, 3].map((n) => async (_ctx, next) => {
      order.push(n)
      return next()
    })
    await runMiddlewareChain(mws, makeCtx(), ok)
    expect(order).toEqual([1, 2, 3])
  })

  test("10 middleware execute in correct order", async () => {
    const order: number[] = []
    const mws: MiddlewareFn[] = Array.from({ length: 10 }, (_, i) =>
      (async (_ctx, next) => { order.push(i); return next() }) as MiddlewareFn
    )
    await runMiddlewareChain(mws, makeCtx(), ok)
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  test("middleware can modify request via ctx.locals", async () => {
    const mw: MiddlewareFn = async (ctx, next) => {
      ctx.locals.injected = true
      return next()
    }
    const ctx = makeCtx()
    await runMiddlewareChain([mw], ctx, async () => {
      expect(ctx.locals.injected).toBe(true)
      return new Response("ok")
    })
  })

  test("middleware can modify response by wrapping", async () => {
    const mw: MiddlewareFn = async (_ctx, next) => {
      const res = await next()
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...Object.fromEntries(res.headers), "X-Wrapped": "true" },
      })
    }
    const res = await runMiddlewareChain([mw], makeCtx(), ok)
    expect(res.headers.get("X-Wrapped")).toBe("true")
  })
})

describe("runMiddlewareChain error handling", () => {
  test("middleware error propagates", async () => {
    const mw: MiddlewareFn = async () => { throw new Error("boom") }
    await expect(runMiddlewareChain([mw], makeCtx(), ok)).rejects.toThrow("boom")
  })

  test("handler error propagates through middleware", async () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const handler = async () => { throw new Error("handler-error") }
    await expect(runMiddlewareChain([mw], makeCtx(), handler)).rejects.toThrow("handler-error")
  })
})

describe("runMiddlewareChain empty array", () => {
  test("calls handler directly when no middleware", async () => {
    let called = false
    await runMiddlewareChain([], makeCtx(), async () => {
      called = true
      return new Response("direct")
    })
    expect(called).toBe(true)
  })
})

describe("runMiddlewareChain header merging", () => {
  test("ctx.setHeader merges into response", async () => {
    const ctx = makeCtx()
    const mw: MiddlewareFn = async (c, next) => {
      c.setHeader("X-Custom", "hello")
      return next()
    }
    const res = await runMiddlewareChain([mw], ctx, ok)
    expect(res.headers.get("X-Custom")).toBe("hello")
  })

  test("Set-Cookie headers appended via ctx.setCookie", async () => {
    const ctx = makeCtx()
    const mw: MiddlewareFn = async (c, next) => {
      c.setCookie("a", "1")
      c.setCookie("b", "2")
      return next()
    }
    const res = await runMiddlewareChain([mw], ctx, ok)
    const cookies = res.headers.getSetCookie()
    expect(cookies.length).toBeGreaterThanOrEqual(2)
  })

  test("middleware adds headers to response", async () => {
    const mw: MiddlewareFn = async (ctx, next) => {
      ctx.setHeader("X-Timing", "50ms")
      return next()
    }
    const ctx = makeCtx()
    const res = await runMiddlewareChain([mw], ctx, ok)
    expect(res.headers.get("X-Timing")).toBe("50ms")
  })
})

describe("RedirectError", () => {
  test("redirect() throws RedirectError with default 302", () => {
    try {
      redirect("/login")
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(RedirectError)
      expect((e as RedirectError).url).toBe("/login")
      expect((e as RedirectError).status).toBe(302)
    }
  })

  test("RedirectError has correct url and status", () => {
    const err = new RedirectError("/dashboard", 301)
    expect(err.url).toBe("/dashboard")
    expect(err.status).toBe(301)
  })

  test("redirect() is typed as never", () => {
    expect(() => redirect("/away", 307)).toThrow()
  })
})

describe("nested middleware chains", () => {
  test("outer and inner chains compose correctly", async () => {
    const order: string[] = []
    const outer: MiddlewareFn = async (_ctx, next) => { order.push("outer"); return next() }
    const inner: MiddlewareFn = async (_ctx, next) => { order.push("inner"); return next() }

    const ctx = makeCtx()
    await runMiddlewareChain([outer], ctx, async () => {
      return runMiddlewareChain([inner], ctx, async () => {
        order.push("handler")
        return new Response("ok")
      })
    })
    expect(order).toEqual(["outer", "inner", "handler"])
  })
})
