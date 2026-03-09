import { describe, test, expect, afterEach } from "bun:test"
import { routeCache, invalidateCache, clearCache } from "../../src/server/cache.ts"
import { createContext } from "../../src/server/middleware.ts"

afterEach(async () => { await clearCache() })

function makeCtx(path: string, method = "GET", headers?: Record<string, string>) {
  return createContext(new Request(`http://localhost${path}`, { method, headers }))
}

function makeHandler(body: string, status = 200) {
  let calls = 0
  const handler = async () => {
    calls++
    return new Response(body, { status, headers: { "Content-Type": "text/html" } })
  }
  return { handler, getCalls: () => calls }
}

describe("routeCache miss/hit", () => {
  test("cache miss on first request", async () => {
    const mw = routeCache({ maxAge: 60 })
    const { handler } = makeHandler("data")
    const res = await mw(makeCtx("/a"), handler)
    expect(res.headers.get("X-Cache")).toBe("MISS")
  })

  test("cache hit on second request", async () => {
    const mw = routeCache({ maxAge: 60 })
    const { handler } = makeHandler("data")
    await mw(makeCtx("/b"), handler)
    const res2 = await mw(makeCtx("/b"), handler)
    expect(res2.headers.get("X-Cache")).toBe("HIT")
  })

  test("Age header present on hit", async () => {
    const mw = routeCache({ maxAge: 60 })
    const { handler } = makeHandler("data")
    await mw(makeCtx("/c"), handler)
    const res2 = await mw(makeCtx("/c"), handler)
    expect(res2.headers.has("Age")).toBe(true)
    expect(Number(res2.headers.get("Age"))).toBeGreaterThanOrEqual(0)
  })

  test("handler called once for cached content", async () => {
    const mw = routeCache({ maxAge: 60 })
    const { handler, getCalls } = makeHandler("data")
    await mw(makeCtx("/d"), handler)
    await mw(makeCtx("/d"), handler)
    await mw(makeCtx("/d"), handler)
    expect(getCalls()).toBe(1)
  })
})

describe("routeCache varies by URL", () => {
  test("different paths = different cache entries", async () => {
    const mw = routeCache({ maxAge: 60 })
    let n = 0
    const handler = async () => new Response(`r${++n}`)
    const r1 = await mw(makeCtx("/x"), handler)
    const r2 = await mw(makeCtx("/y"), handler)
    expect(await r1.text()).toBe("r1")
    expect(await r2.text()).toBe("r2")
    expect(r2.headers.get("X-Cache")).toBe("MISS")
  })

  test("different query params = different entries", async () => {
    const mw = routeCache({ maxAge: 60 })
    let n = 0
    const handler = async () => new Response(`r${++n}`)
    await mw(makeCtx("/p?a=1"), handler)
    const r2 = await mw(makeCtx("/p?a=2"), handler)
    expect(r2.headers.get("X-Cache")).toBe("MISS")
  })
})

describe("routeCache varyHeaders", () => {
  test("varies cache by custom headers", async () => {
    const mw = routeCache({ maxAge: 60, vary: ["Accept-Language"] })
    let n = 0
    const handler = async () => new Response(`r${++n}`)
    await mw(makeCtx("/v", "GET", { "Accept-Language": "en" }), handler)
    const r2 = await mw(makeCtx("/v", "GET", { "Accept-Language": "fr" }), handler)
    expect(r2.headers.get("X-Cache")).toBe("MISS")
  })
})

describe("invalidateCache / clearCache", () => {
  test("invalidateCache removes entry by path", async () => {
    const mw = routeCache({ maxAge: 60 })
    const { handler } = makeHandler("data")
    await mw(makeCtx("/rm"), handler)
    await invalidateCache("/rm")
    const res = await mw(makeCtx("/rm"), handler)
    expect(res.headers.get("X-Cache")).toBe("MISS")
  })

  test("clearCache removes all entries", async () => {
    const mw = routeCache({ maxAge: 60 })
    const { handler } = makeHandler("data")
    await mw(makeCtx("/e1"), handler)
    await mw(makeCtx("/e2"), handler)
    await clearCache()
    const r1 = await mw(makeCtx("/e1"), handler)
    const r2 = await mw(makeCtx("/e2"), handler)
    expect(r1.headers.get("X-Cache")).toBe("MISS")
    expect(r2.headers.get("X-Cache")).toBe("MISS")
  })
})

describe("routeCache error responses", () => {
  test("does not cache non-200 responses", async () => {
    const mw = routeCache({ maxAge: 60 })
    let n = 0
    const handler = async () => new Response(`err${++n}`, { status: 500 })
    await mw(makeCtx("/err"), handler)
    const r2 = await mw(makeCtx("/err"), handler)
    expect(await r2.text()).toBe("err2")
  })

  test("does not cache responses that set cookies", async () => {
    const mw = routeCache({ maxAge: 60 })
    let n = 0
    const handler = async () => new Response(`ok${++n}`, {
      headers: { "Set-Cookie": "session=abc; Path=/" },
    })
    await mw(makeCtx("/cookie"), handler)
    const r2 = await mw(makeCtx("/cookie"), handler)
    expect(await r2.text()).toBe("ok2")
    expect(r2.headers.get("X-Cache")).toBeNull()
  })
})

describe("routeCache custom key", () => {
  test("custom key function overrides default", async () => {
    const mw = routeCache({ maxAge: 60, key: (url) => url.pathname })
    let n = 0
    const handler = async () => new Response(`r${++n}`)
    await mw(makeCtx("/k?a=1"), handler)
    const r2 = await mw(makeCtx("/k?a=999"), handler)
    // Same pathname → HIT (query ignored by custom key)
    expect(r2.headers.get("X-Cache")).toBe("HIT")
  })
})


describe("routeCache modes", () => {
  test("shared mode emits public cache-control with s-maxage", async () => {
    const mw = routeCache({ maxAge: 60, staleWhileRevalidate: 30, mode: "shared" })
    const res = await mw(makeCtx("/shared"), async () => new Response("shared"))

    expect(res.headers.get("Cache-Control")).toContain("public")
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60")
    expect(res.headers.get("Vary")).toContain("Accept")
  })

  test("public mode can still opt into auth-aware vary explicitly", async () => {
    const mw = routeCache({ maxAge: 60, mode: "public", includeAuthHeaders: true })
    let n = 0
    const handler = async () => new Response(`r${++n}`)

    await mw(makeCtx("/public", "GET", { Cookie: "sid=one" }), handler)
    const second = await mw(makeCtx("/public", "GET", { Cookie: "sid=two" }), handler)

    expect(second.headers.get("X-Cache")).toBe("MISS")
    expect(second.headers.get("Vary")).toContain("Cookie")
  })
})
