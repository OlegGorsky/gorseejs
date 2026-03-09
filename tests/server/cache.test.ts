import { describe, it, expect, afterEach } from "bun:test"
import { routeCache, clearCache, resolveCacheMode, shouldIncludeAuthHeadersForCache } from "../../src/server/cache.ts"
import { createContext } from "../../src/server/middleware.ts"

describe("routeCache", () => {
  afterEach(async () => { await clearCache() })

  function makeCtx(path: string) {
    return createContext(new Request(`http://localhost${path}`))
  }

  it("defaults cache mode to private", () => {
    expect(resolveCacheMode({ maxAge: 60 })).toBe("private")
    expect(shouldIncludeAuthHeadersForCache({ maxAge: 60 })).toBe(true)
  })

  it("infers public mode when auth headers are explicitly excluded", () => {
    expect(resolveCacheMode({ maxAge: 60, includeAuthHeaders: false })).toBe("public")
    expect(shouldIncludeAuthHeadersForCache({ maxAge: 60, includeAuthHeaders: false })).toBe(false)
  })

  it("caches GET responses", async () => {
    const mw = routeCache({ maxAge: 60 })
    let callCount = 0
    const handler = async () => {
      callCount++
      return new Response(`response-${callCount}`, {
        headers: { "Content-Type": "text/html" },
      })
    }

    const ctx1 = makeCtx("/page")
    const res1 = await mw(ctx1, handler)
    expect(await res1.text()).toBe("response-1")
    expect(res1.headers.get("X-Cache")).toBe("MISS")

    const ctx2 = makeCtx("/page")
    const res2 = await mw(ctx2, handler)
    expect(await res2.text()).toBe("response-1")
    expect(res2.headers.get("X-Cache")).toBe("HIT")
    expect(callCount).toBe(1)
  })

  it("does not cache POST requests", async () => {
    const mw = routeCache({ maxAge: 60 })
    const ctx = createContext(new Request("http://localhost/page", { method: "POST" }))
    const res = await mw(ctx, async () => new Response("ok"))
    expect(res.headers.get("X-Cache")).toBeNull()
  })

  it("varies cache by headers", async () => {
    const mw = routeCache({ maxAge: 60, vary: ["Accept-Language"] })
    let callCount = 0

    const handler = async () => new Response(`resp-${++callCount}`)

    const ctx1 = createContext(new Request("http://localhost/page", {
      headers: { "Accept-Language": "en" },
    }))
    await mw(ctx1, handler)

    const ctx2 = createContext(new Request("http://localhost/page", {
      headers: { "Accept-Language": "ru" },
    }))
    const res2 = await mw(ctx2, handler)
    expect(res2.headers.get("X-Cache")).toBe("MISS")
    expect(callCount).toBe(2)
  })

  it("varies by Cookie and Authorization headers by default", async () => {
    const mw = routeCache({ maxAge: 60 })
    let callCount = 0
    const handler = async () => new Response(`resp-${++callCount}`)

    await mw(createContext(new Request("http://localhost/page", {
      headers: { Cookie: "session=a" },
    })), handler)

    const res2 = await mw(createContext(new Request("http://localhost/page", {
      headers: { Cookie: "session=b" },
    })), handler)

    expect(res2.headers.get("X-Cache")).toBe("MISS")
    expect(res2.headers.get("Vary")).toContain("Cookie")
    expect(res2.headers.get("Vary")).toContain("Authorization")
    expect(callCount).toBe(2)
  })

  it("always varies by partial-navigation headers to separate response shapes", async () => {
    const mw = routeCache({ maxAge: 60 })
    let callCount = 0
    const handler = async () => new Response(`resp-${++callCount}`)

    const page = await mw(createContext(new Request("http://localhost/page", {
      headers: { Accept: "text/html" },
    })), handler)

    const partial = await mw(createContext(new Request("http://localhost/page", {
      headers: {
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    })), handler)

    expect(await page.text()).toBe("resp-1")
    expect(await partial.text()).toBe("resp-2")
    expect(page.headers.get("Vary")).toContain("Accept")
    expect(page.headers.get("Vary")).toContain("X-Gorsee-Navigate")
  })

  it("supports explicit no-store mode", async () => {
    const mw = routeCache({ maxAge: 60, mode: "no-store" })
    let callCount = 0
    const handler = async () => new Response(`resp-${++callCount}`)

    const first = await mw(makeCtx("/page"), handler)
    const second = await mw(makeCtx("/page"), handler)

    expect(await first.text()).toBe("resp-1")
    expect(await second.text()).toBe("resp-2")
    expect(second.headers.get("Cache-Control")).toBe("no-store")
  })
})
