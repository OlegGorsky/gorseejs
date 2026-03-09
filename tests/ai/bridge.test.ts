import { describe, expect, test } from "bun:test"
import { createAIBridgeHandler } from "../../src/ai/index.ts"

describe("ai bridge handler", () => {
  test("accepts POST events and exposes snapshot endpoints", async () => {
    const received: string[] = []
    const bridge = createAIBridgeHandler({
      onEvent: (event) => { received.push(event.kind) },
    })

    const postResponse = await bridge.fetch(new Request("http://127.0.0.1:4318/gorsee/ai-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "evt-1",
        kind: "diagnostic.issue",
        severity: "error",
        ts: new Date().toISOString(),
        source: "check",
        message: "unsafe redirect",
        code: "E905",
        file: "routes/login.tsx",
        line: 12,
        data: { fix: "Use ctx.redirect()" },
      }),
    }))

    expect(postResponse.status).toBe(200)
    expect(received).toEqual(["diagnostic.issue"])

    const snapshotResponse = await bridge.fetch(new Request("http://127.0.0.1:4318/gorsee/ai-events/events"))
    const snapshot = await snapshotResponse.json()
    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.diagnostics).toHaveLength(1)
    expect(snapshot.diagnostics[0].code).toBe("E905")

    const healthResponse = await bridge.fetch(new Request("http://127.0.0.1:4318/gorsee/ai-events/health"))
    const health = await healthResponse.json()
    expect(health.status).toBe("ok")
  })

  test("rejects invalid AI event payloads", async () => {
    const bridge = createAIBridgeHandler()
    const response = await bridge.fetch(new Request("http://127.0.0.1:4318/gorsee/ai-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "broken" }),
    }))

    expect(response.status).toBe(400)
  })

  test("rejects oversized AI bridge payloads", async () => {
    const bridge = createAIBridgeHandler({ maxBodyBytes: 128 })
    const response = await bridge.fetch(new Request("http://127.0.0.1:4318/gorsee/ai-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "evt-oversized",
        kind: "diagnostic.issue",
        severity: "error",
        ts: new Date().toISOString(),
        source: "check",
        message: "x".repeat(512),
      }),
    }))

    expect(response.status).toBe(413)
  })
})
