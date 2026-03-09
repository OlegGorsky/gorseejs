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
})
