import { describe, expect, test } from "bun:test"
import { dispatchRuntimeRequestPlan } from "../../src/server/runtime-dispatch.ts"

describe("runtime dispatch", () => {
  test("resolves the first surface that returns a response", async () => {
    const order: string[] = []

    const result = await dispatchRuntimeRequestPlan({
      plan: ["static", "route", "not-found"],
      pathname: "/dashboard",
      request: new Request("http://localhost/dashboard"),
      trace: { requestId: "req-1", traceId: "trace-1", spanId: "span-1" },
      startTs: performance.now(),
      source: "runtime",
      handlers: {
        static: async () => {
          order.push("static")
          return null
        },
        route: async () => {
          order.push("route")
          return new Response("ok", { status: 200 })
        },
        "not-found": async () => {
          order.push("not-found")
          return new Response("missing", { status: 404 })
        },
      },
    })

    expect(order).toEqual(["static", "route"])
    expect(result).not.toBeNull()
    expect(result?.surface).toBe("route")
    expect(await result?.response.text()).toBe("ok")
  })

  test("falls through to not-found when no earlier surface handles the request", async () => {
    const result = await dispatchRuntimeRequestPlan({
      plan: ["bundle", "route", "not-found"],
      pathname: "/missing",
      request: new Request("http://localhost/missing"),
      trace: { requestId: "req-2", traceId: "trace-2", spanId: "span-2" },
      startTs: performance.now(),
      source: "dev",
      handlers: {
        bundle: async () => null,
        route: async () => null,
        "not-found": async () => new Response("missing", { status: 404 }),
      },
    })

    expect(result).not.toBeNull()
    expect(result?.surface).toBe("not-found")
    expect(result?.response.status).toBe(404)
  })
})
