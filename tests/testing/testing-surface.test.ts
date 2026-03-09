import { describe, expect, test } from "bun:test"
import { defineAction } from "../../src/server/action.ts"
import { testAction, testRouteHandler } from "../../src/testing/index.ts"

describe("testing surface", () => {
  test("testAction executes through action wrapper", async () => {
    const action = defineAction(async () => ({ ok: true }))
    const result = await testAction(action, "/submit")

    expect(result.status).toBe(200)
    expect(result.data).toEqual({ ok: true })
  })

  test("testRouteHandler executes a route handler with context", async () => {
    const response = await testRouteHandler((ctx) => new Response(`path:${new URL(ctx.request.url).pathname}`), "/hello")
    expect(await response.text()).toBe("path:/hello")
  })
})
