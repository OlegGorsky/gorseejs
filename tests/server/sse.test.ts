import { describe, it, expect } from "bun:test"
import { createSSEStream } from "../../src/server/sse.ts"

describe("createSSEStream", () => {
  it("creates response with correct headers", () => {
    const { response } = createSSEStream()
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(response.headers.get("Cache-Control")).toBe("no-cache")
  })

  it("sends formatted SSE events", async () => {
    const { response, send, close } = createSSEStream()

    // Send events and close
    setTimeout(() => {
      send("update", { count: 1 })
      send("update", { count: 2 })
      close()
    }, 10)

    const text = await response.text()
    expect(text).toContain('event: update\ndata: {"count":1}')
    expect(text).toContain('event: update\ndata: {"count":2}')
  })

  it("accepts custom headers", () => {
    const { response } = createSSEStream({ headers: { "X-Custom": "test" } })
    expect(response.headers.get("X-Custom")).toBe("test")
  })

  it("ignores sends after close", async () => {
    const { response, send, close } = createSSEStream()

    setTimeout(() => {
      send("before-close", { ok: true })
      close()
      send("after-close", { ok: false })
      close()
    }, 10)

    const text = await response.text()
    expect(text).toContain('event: before-close\ndata: {"ok":true}')
    expect(text).not.toContain("after-close")
  })

  it("preserves event ordering for sequential sends", async () => {
    const { response, send, close } = createSSEStream()

    setTimeout(() => {
      send("step", { index: 1 })
      send("step", { index: 2 })
      send("step", { index: 3 })
      close()
    }, 10)

    const text = await response.text()
    expect(text.indexOf('"index":1')).toBeLessThan(text.indexOf('"index":2'))
    expect(text.indexOf('"index":2')).toBeLessThan(text.indexOf('"index":3'))
  })
})
