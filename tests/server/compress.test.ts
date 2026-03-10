import { describe, it, expect } from "bun:test"
import { compress } from "../../src/server/compress.ts"
import { createContext } from "../../src/server/middleware.ts"

function makeRequest(acceptEncoding = ""): Request {
  return new Request("http://localhost/test", {
    headers: { "Accept-Encoding": acceptEncoding },
  })
}

describe("compress middleware", () => {
  const mw = compress()

  it("passes through non-compressible content types", async () => {
    const ctx = createContext(makeRequest("gzip"))
    const response = await mw(ctx, async () =>
      new Response("binary data", { headers: { "Content-Type": "image/png" } })
    )
    expect(response.headers.get("Content-Encoding")).toBeNull()
  })

  it("compresses text/html with gzip", async () => {
    const ctx = createContext(makeRequest("gzip, deflate"))
    const response = await mw(ctx, async () =>
      new Response("<h1>Hello</h1>", { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
    expect(response.headers.get("Content-Encoding")).toBe("gzip")
    expect(response.headers.get("Content-Length")).toBeNull()
  })

  it("compresses with deflate when gzip not accepted", async () => {
    const ctx = createContext(makeRequest("deflate"))
    const response = await mw(ctx, async () =>
      new Response("{}", { headers: { "Content-Type": "application/json" } })
    )
    expect(response.headers.get("Content-Encoding")).toBe("deflate")
  })

  it("does not compress when no encoding accepted", async () => {
    const ctx = createContext(makeRequest(""))
    const response = await mw(ctx, async () =>
      new Response("<p>hi</p>", { headers: { "Content-Type": "text/html" } })
    )
    expect(response.headers.get("Content-Encoding")).toBeNull()
  })

  it("does not double-compress already encoded responses", async () => {
    const ctx = createContext(makeRequest("gzip"))
    const response = await mw(ctx, async () =>
      new Response("compressed", {
        headers: { "Content-Type": "text/html", "Content-Encoding": "br" },
      })
    )
    expect(response.headers.get("Content-Encoding")).toBe("br")
  })

  it("passes through compressible responses without a body", async () => {
    const ctx = createContext(makeRequest("gzip"))
    const response = await mw(ctx, async () =>
      new Response(null, {
        status: 204,
        headers: { "Content-Type": "text/html" },
      })
    )
    expect(response.status).toBe(204)
    expect(response.headers.get("Content-Encoding")).toBeNull()
  })

  it("preserves status and statusText when compressing", async () => {
    const ctx = createContext(makeRequest("gzip"))
    const response = await mw(ctx, async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        statusText: "Created",
        headers: { "Content-Type": "application/json" },
      })
    )
    expect(response.status).toBe(201)
    expect(response.statusText).toBe("Created")
    expect(response.headers.get("Content-Encoding")).toBe("gzip")
  })

  it("does not select encodings disabled via q=0", async () => {
    const ctx = createContext(makeRequest("gzip;q=0, deflate;q=1"))
    const response = await mw(ctx, async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      })
    )

    expect(response.headers.get("Content-Encoding")).toBe("deflate")
  })

  it("treats wildcard accept-encoding as allowing gzip", async () => {
    const ctx = createContext(makeRequest("*"))
    const response = await mw(ctx, async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      })
    )

    expect(response.headers.get("Content-Encoding")).toBe("gzip")
  })

  it("matches accepted encodings case-insensitively", async () => {
    const ctx = createContext(makeRequest("GZIP"))
    const response = await mw(ctx, async () =>
      new Response("<p>hi</p>", { headers: { "Content-Type": "text/html" } })
    )

    expect(response.headers.get("Content-Encoding")).toBe("gzip")
  })

  it("does not let wildcard override an explicitly disabled encoding", async () => {
    const ctx = createContext(makeRequest("gzip;q=0, *;q=1"))
    const response = await mw(ctx, async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      })
    )

    expect(response.headers.get("Content-Encoding")).toBe("deflate")
  })

  it("chooses the supported encoding with the highest q weight", async () => {
    const ctx = createContext(makeRequest("gzip;q=0.2, deflate;q=0.8"))
    const response = await mw(ctx, async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      })
    )

    expect(response.headers.get("Content-Encoding")).toBe("deflate")
  })

  it("compresses large text responses without truncating the body stream", async () => {
    const ctx = createContext(makeRequest("gzip"))
    const payload = "x".repeat(256 * 1024)
    const response = await mw(ctx, async () =>
      new Response(payload, { headers: { "Content-Type": "text/html" } })
    )

    expect(response.headers.get("Content-Encoding")).toBe("gzip")
    expect(response.headers.get("Content-Length")).toBeNull()
    expect(response.body).not.toBeNull()
  })
})
