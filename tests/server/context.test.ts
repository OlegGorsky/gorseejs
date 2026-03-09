import { describe, it, expect } from "bun:test"
import { createContext, redirect, RedirectError } from "../../src/server/middleware.ts"

describe("Context cookies", () => {
  it("parses cookies from request", () => {
    const req = new Request("http://localhost/", {
      headers: { Cookie: "session=abc123; theme=dark" },
    })
    const ctx = createContext(req)
    expect(ctx.cookies.get("session")).toBe("abc123")
    expect(ctx.cookies.get("theme")).toBe("dark")
  })

  it("setCookie adds to responseHeaders and cookies map", () => {
    const ctx = createContext(new Request("http://localhost/"))
    ctx.setCookie("token", "xyz", { httpOnly: true, secure: true })
    expect(ctx.cookies.get("token")).toBe("xyz")
    const setCookie = ctx.responseHeaders.get("set-cookie")
    expect(setCookie).toContain("token=xyz")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Secure")
  })

  it("deleteCookie sets max-age=0", () => {
    const ctx = createContext(new Request("http://localhost/", {
      headers: { Cookie: "session=abc" },
    }))
    ctx.deleteCookie("session")
    expect(ctx.cookies.has("session")).toBe(false)
    const setCookie = ctx.responseHeaders.get("set-cookie")
    expect(setCookie).toContain("Max-Age=0")
  })

  it("setHeader adds custom response headers", () => {
    const ctx = createContext(new Request("http://localhost/"))
    ctx.setHeader("X-Custom", "hello")
    expect(ctx.responseHeaders.get("X-Custom")).toBe("hello")
  })

  it("redirect returns response with Location header", () => {
    const ctx = createContext(new Request("http://localhost/"))
    const res = ctx.redirect("/dashboard", 303)
    expect(res.status).toBe(303)
    expect(res.headers.get("Location")).toBe("/dashboard")
  })

  it("redirect includes pending cookies", () => {
    const ctx = createContext(new Request("http://localhost/"))
    ctx.setCookie("session", "new-session")
    const res = ctx.redirect("/home")
    expect(res.headers.get("Set-Cookie")).toContain("session=new-session")
  })
})

describe("redirect() throwable", () => {
  it("throws RedirectError", () => {
    expect(() => redirect("/login")).toThrow()
    try {
      redirect("/login", 301)
    } catch (e) {
      expect(e).toBeInstanceOf(RedirectError)
      expect((e as RedirectError).url).toBe("/login")
      expect((e as RedirectError).status).toBe(301)
    }
  })
})
