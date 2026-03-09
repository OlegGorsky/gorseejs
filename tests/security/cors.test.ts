import { describe, it, expect } from "bun:test"
import { cors } from "../../src/security/cors.ts"
import { createContext } from "../../src/server/middleware.ts"

const jsonResponse = async () => new Response("{}", { headers: { "Content-Type": "application/json" } })

describe("CORS middleware", () => {
  it("adds wildcard origin by default", async () => {
    const mw = cors()
    const ctx = createContext(new Request("http://localhost/api"))
    const res = await mw(ctx, jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("handles preflight OPTIONS request", async () => {
    const mw = cors()
    const ctx = createContext(new Request("http://localhost/api", { method: "OPTIONS" }))
    const res = await mw(ctx, jsonResponse)
    expect(res.status).toBe(204)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET")
  })

  it("restricts to specific origin", async () => {
    const mw = cors({ origin: "https://example.com" })
    const ctx = createContext(new Request("http://localhost/api", {
      headers: { Origin: "https://example.com" },
    }))
    const res = await mw(ctx, jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com")
    expect(res.headers.get("Vary")).toContain("Origin")
  })

  it("rejects disallowed origin", async () => {
    const mw = cors({ origin: "https://example.com" })
    const ctx = createContext(new Request("http://localhost/api", {
      headers: { Origin: "https://evil.com" },
    }))
    const res = await mw(ctx, jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  it("supports array of origins", async () => {
    const mw = cors({ origin: ["https://a.com", "https://b.com"] })
    const ctx = createContext(new Request("http://localhost/api", {
      headers: { Origin: "https://b.com" },
    }))
    const res = await mw(ctx, jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://b.com")
  })

  it("supports function origin check", async () => {
    const mw = cors({ origin: (o) => o.endsWith(".example.com") })
    const ctx = createContext(new Request("http://localhost/api", {
      headers: { Origin: "https://app.example.com" },
    }))
    const res = await mw(ctx, jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })

  it("sets credentials header when enabled", async () => {
    const mw = cors({ origin: "https://a.com", credentials: true })
    const ctx = createContext(new Request("http://localhost/api", {
      headers: { Origin: "https://a.com" },
    }))
    const res = await mw(ctx, jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })
})
