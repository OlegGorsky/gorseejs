import { describe, test, expect } from "bun:test"
import { cors } from "../../src/security/cors.ts"
import { createContext } from "../../src/server/middleware.ts"

const jsonResponse = async () =>
  new Response("{}", { headers: { "Content-Type": "application/json" } })

function makeCtx(method: string, origin?: string) {
  const headers: Record<string, string> = {}
  if (origin) headers["Origin"] = origin
  return createContext(new Request("http://localhost/api", { method, headers }))
}

describe("CORS deep", () => {
  test("Access-Control-Allow-Origin set on GET", async () => {
    const mw = cors()
    const res = await mw(makeCtx("GET"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  test("wildcard origin on preflight", async () => {
    const mw = cors()
    const res = await mw(makeCtx("OPTIONS"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(res.status).toBe(204)
  })

  test("preflight includes Allow-Methods", async () => {
    const mw = cors()
    const res = await mw(makeCtx("OPTIONS"), jsonResponse)
    const methods = res.headers.get("Access-Control-Allow-Methods")!
    expect(methods).toContain("GET")
    expect(methods).toContain("POST")
    expect(methods).toContain("DELETE")
  })

  test("preflight includes Allow-Headers", async () => {
    const mw = cors()
    const res = await mw(makeCtx("OPTIONS"), jsonResponse)
    const headers = res.headers.get("Access-Control-Allow-Headers")!
    expect(headers).toContain("Content-Type")
    expect(headers).toContain("Authorization")
  })

  test("preflight includes Max-Age", async () => {
    const mw = cors({ maxAge: 3600 })
    const res = await mw(makeCtx("OPTIONS"), jsonResponse)
    expect(res.headers.get("Access-Control-Max-Age")).toBe("3600")
  })

  test("specific origin set on matching request", async () => {
    const mw = cors({ origin: "https://app.com" })
    const res = await mw(makeCtx("GET", "https://app.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.com")
  })

  test("non-matching origin gets no ACAO header", async () => {
    const mw = cors({ origin: "https://app.com" })
    const res = await mw(makeCtx("GET", "https://evil.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  test("multiple allowed origins — first match", async () => {
    const mw = cors({ origin: ["https://a.com", "https://b.com"] })
    const res = await mw(makeCtx("GET", "https://b.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://b.com")
  })

  test("multiple allowed origins — no match", async () => {
    const mw = cors({ origin: ["https://a.com", "https://b.com"] })
    const res = await mw(makeCtx("GET", "https://c.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  test("credentials header set when enabled", async () => {
    const mw = cors({ origin: "https://a.com", credentials: true })
    const res = await mw(makeCtx("GET", "https://a.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })

  test("no credentials header when disabled", async () => {
    const mw = cors({ origin: "https://a.com", credentials: false })
    const res = await mw(makeCtx("GET", "https://a.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull()
  })

  test("credentials with wildcard uses specific origin on preflight", async () => {
    const mw = cors({ origin: "https://a.com", credentials: true })
    const res = await mw(makeCtx("OPTIONS", "https://a.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://a.com")
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })

  test("expose headers on preflight", async () => {
    const mw = cors({ exposeHeaders: ["X-Custom"] })
    const res = await mw(makeCtx("OPTIONS"), jsonResponse)
    expect(res.headers.get("Access-Control-Expose-Headers")).toBe("X-Custom")
  })

  test("expose headers on actual request", async () => {
    const mw = cors({ exposeHeaders: ["X-Custom", "X-Other"] })
    const res = await mw(makeCtx("GET"), jsonResponse)
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("X-Custom")
  })

  test("custom methods on preflight", async () => {
    const mw = cors({ methods: ["GET", "POST"] })
    const res = await mw(makeCtx("OPTIONS"), jsonResponse)
    const methods = res.headers.get("Access-Control-Allow-Methods")!
    expect(methods).toBe("GET, POST")
  })

  test("non-matching credentialed preflight does not reflect origin", async () => {
    const mw = cors({ origin: "https://app.com", credentials: true })
    const res = await mw(makeCtx("OPTIONS", "https://evil.com"), jsonResponse)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull()
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })
})
