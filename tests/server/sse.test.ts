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
})
