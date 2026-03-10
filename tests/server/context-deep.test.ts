import { describe, test, expect } from "bun:test"
import { createContext, redirect, RedirectError, runMiddlewareChain } from "../../src/server/middleware.ts"

function makeReq(url: string, headers?: Record<string, string>) {
  return new Request(url, { headers })
}

describe("createContext URL parsing", () => {
  test("parses pathname from URL", () => {
    const ctx = createContext(makeReq("http://localhost/users/list"))
    expect(ctx.url.pathname).toBe("/users/list")
  })

  test("parses query params from URL", () => {
    const ctx = createContext(makeReq("http://localhost/search?q=hello&page=3"))
    expect(ctx.url.searchParams.get("q")).toBe("hello")
    expect(ctx.url.searchParams.get("page")).toBe("3")
  })

  test("parses hash and host", () => {
    const ctx = createContext(makeReq("http://example.com:8080/path"))
    expect(ctx.url.host).toBe("example.com:8080")
  })
})

describe("createContext cookies", () => {
  test("no cookies produces empty map", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    expect(ctx.cookies.size).toBe(0)
  })

  test("multiple cookies parsed correctly", () => {
    const ctx = createContext(makeReq("http://localhost/", {
      cookie: "a=1; b=2; c=3",
    }))
    expect(ctx.cookies.size).toBe(3)
    expect(ctx.cookies.get("a")).toBe("1")
    expect(ctx.cookies.get("c")).toBe("3")
  })

  test("URL-encoded cookie values preserved as-is", () => {
    const ctx = createContext(makeReq("http://localhost/", {
      cookie: "data=hello%20world",
    }))
    expect(ctx.cookies.get("data")).toBe("hello%20world")
  })

  test("cookie value with equals sign", () => {
    const ctx = createContext(makeReq("http://localhost/", {
      cookie: "token=abc=def=ghi",
    }))
    expect(ctx.cookies.get("token")).toBe("abc=def=ghi")
  })
})

describe("createContext params and locals", () => {
  test("params populated from argument", () => {
    const ctx = createContext(makeReq("http://localhost/u/42"), { id: "42", slug: "hello" })
    expect(ctx.params.id).toBe("42")
    expect(ctx.params.slug).toBe("hello")
  })

  test("locals starts empty", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    expect(Object.keys(ctx.locals)).toHaveLength(0)
  })

  test("locals can be set and read", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.locals.user = { name: "Alice" }
    expect((ctx.locals.user as { name: string }).name).toBe("Alice")
  })
})

describe("setCookie options", () => {
  test("setCookie with maxAge", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { maxAge: 3600 })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("Max-Age=3600")
  })

  test("setCookie with expires", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    const date = new Date("2025-12-31T00:00:00Z")
    ctx.setCookie("s", "v", { expires: date })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("Expires=")
  })

  test("setCookie with path", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { path: "/admin" })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("Path=/admin")
  })

  test("setCookie with domain", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { domain: ".example.com" })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("Domain=.example.com")
  })

  test("setCookie with secure flag", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { secure: true })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("Secure")
  })

  test("setCookie with httpOnly flag", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { httpOnly: true })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("HttpOnly")
  })

  test("setCookie with sameSite Strict", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { sameSite: "Strict" })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("SameSite=Strict")
  })

  test("setCookie with sameSite Lax", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { sameSite: "Lax" })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("SameSite=Lax")
  })

  test("setCookie with sameSite None", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("s", "v", { sameSite: "None" })
    expect(ctx.responseHeaders.get("set-cookie")).toContain("SameSite=None")
  })

  test("setCookie updates cookies map", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("token", "abc123")
    expect(ctx.cookies.get("token")).toBe("abc123")
  })

  test("multiple setCookie calls accumulate", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("a", "1")
    ctx.setCookie("b", "2")
    expect(ctx.cookies.get("a")).toBe("1")
    expect(ctx.cookies.get("b")).toBe("2")
  })
})

describe("deleteCookie", () => {
  test("sets maxAge=0 and removes from map", () => {
    const ctx = createContext(makeReq("http://localhost/", { cookie: "s=val" }))
    expect(ctx.cookies.has("s")).toBe(true)
    ctx.deleteCookie("s")
    expect(ctx.cookies.has("s")).toBe(false)
    expect(ctx.responseHeaders.get("set-cookie")).toContain("Max-Age=0")
  })
})

describe("ctx.redirect", () => {
  test("returns 302 by default", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    const res = ctx.redirect("/home")
    expect(res.status).toBe(302)
  })

  test("custom status 301", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    const res = ctx.redirect("/new", 301)
    expect(res.status).toBe(301)
    expect(res.headers.get("Location")).toBe("/new")
  })

  test("custom status 307", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    expect(ctx.redirect("/tmp", 307).status).toBe(307)
  })

  test("redirect includes pending cookies", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setCookie("sess", "xyz")
    const res = ctx.redirect("/dash")
    expect(res.headers.get("Set-Cookie")).toContain("sess=xyz")
  })

  test("middleware redirect does not duplicate pending cookies", async () => {
    const ctx = createContext(makeReq("http://localhost/"))
    const res = await runMiddlewareChain([
      async (ctx) => {
        ctx.setCookie("sess", "xyz")
        return ctx.redirect("/dash")
      },
    ], ctx, async () => new Response("ok"))

    expect(res.headers.getSetCookie()).toEqual(["sess=xyz; Path=/"])
  })
})

describe("ctx.setHeader", () => {
  test("adds to responseHeaders", () => {
    const ctx = createContext(makeReq("http://localhost/"))
    ctx.setHeader("X-Request-Id", "abc")
    expect(ctx.responseHeaders.get("X-Request-Id")).toBe("abc")
  })
})
