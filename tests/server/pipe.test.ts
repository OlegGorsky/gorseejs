import { describe, it, expect } from "bun:test"
import { pipe, when, forMethods, forPaths } from "../../src/server/pipe.ts"
import { createContext, type MiddlewareFn } from "../../src/server/middleware.ts"

function addHeader(name: string, value: string): MiddlewareFn {
  return async (ctx, next) => {
    const res = await next()
    res.headers.set(name, value)
    return res
  }
}

describe("pipe", () => {
  it("composes middleware in order", async () => {
    const mw = pipe(
      addHeader("X-First", "1"),
      addHeader("X-Second", "2"),
    )
    const ctx = createContext(new Request("http://localhost/"))
    const res = await mw(ctx, async () => new Response("OK"))
    expect(res.headers.get("X-First")).toBe("1")
    expect(res.headers.get("X-Second")).toBe("2")
  })

  it("empty pipe passes through", async () => {
    const mw = pipe()
    const ctx = createContext(new Request("http://localhost/"))
    const res = await mw(ctx, async () => new Response("direct"))
    expect(await res.text()).toBe("direct")
  })
})

describe("when", () => {
  it("runs middleware when predicate is true", async () => {
    const mw = when(
      (ctx) => ctx.url.pathname.startsWith("/api"),
      addHeader("X-API", "true"),
    )
    const ctx = createContext(new Request("http://localhost/api/users"))
    const res = await mw(ctx, async () => new Response("OK"))
    expect(res.headers.get("X-API")).toBe("true")
  })

  it("skips middleware when predicate is false", async () => {
    const mw = when(
      (ctx) => ctx.url.pathname.startsWith("/api"),
      addHeader("X-API", "true"),
    )
    const ctx = createContext(new Request("http://localhost/page"))
    const res = await mw(ctx, async () => new Response("OK"))
    expect(res.headers.get("X-API")).toBeNull()
  })
})

describe("forMethods", () => {
  it("applies only for specified methods", async () => {
    const mw = forMethods(["POST", "PUT"], addHeader("X-Write", "true"))

    const ctx1 = createContext(new Request("http://localhost/", { method: "POST" }))
    const res1 = await mw(ctx1, async () => new Response("OK"))
    expect(res1.headers.get("X-Write")).toBe("true")

    const ctx2 = createContext(new Request("http://localhost/"))
    const res2 = await mw(ctx2, async () => new Response("OK"))
    expect(res2.headers.get("X-Write")).toBeNull()
  })
})

describe("forPaths", () => {
  it("applies only for matching path prefixes", async () => {
    const mw = forPaths(["/admin"], addHeader("X-Admin", "true"))

    const ctx1 = createContext(new Request("http://localhost/admin/settings"))
    const res1 = await mw(ctx1, async () => new Response("OK"))
    expect(res1.headers.get("X-Admin")).toBe("true")

    const ctx2 = createContext(new Request("http://localhost/public"))
    const res2 = await mw(ctx2, async () => new Response("OK"))
    expect(res2.headers.get("X-Admin")).toBeNull()
  })
})
