import { describe, test, expect } from "bun:test"
import {
  createTestRequest,
  createTestContext,
  runTestMiddleware,
  renderComponent,
  testLoader,
} from "../../src/testing/index.ts"
import type { MiddlewareFn, Context } from "../../src/server/middleware.ts"

describe("testing utils deep", () => {
  test("createTestRequest defaults to GET", () => {
    const req = createTestRequest("/test")
    expect(req.method).toBe("GET")
  })

  test("createTestRequest with POST method", () => {
    const req = createTestRequest("/test", { method: "POST" })
    expect(req.method).toBe("POST")
  })

  test("createTestRequest with custom headers", () => {
    const req = createTestRequest("/test", { headers: { "X-Token": "abc" } })
    expect(req.headers.get("X-Token")).toBe("abc")
  })

  test("createTestRequest with string body", () => {
    const req = createTestRequest("/test", { method: "POST", body: "raw text" })
    expect(req.method).toBe("POST")
  })

  test("createTestRequest with object body sets JSON content-type", () => {
    const req = createTestRequest("/test", { method: "POST", body: { key: "val" } })
    expect(req.headers.get("Content-Type")).toBe("application/json")
  })

  test("createTestRequest URL has correct pathname", () => {
    const req = createTestRequest("/api/users/123")
    expect(new URL(req.url).pathname).toBe("/api/users/123")
  })

  test("createTestContext creates context object", () => {
    const ctx = createTestContext("/page")
    expect(ctx.request).toBeDefined()
    expect(ctx.url).toBeDefined()
  })

  test("createTestContext with params", () => {
    const ctx = createTestContext("/users/1", { params: { id: "1" } })
    expect(ctx.params.id).toBe("1")
  })

  test("createTestContext with method and headers", () => {
    const ctx = createTestContext("/api", {
      method: "DELETE",
      headers: { Authorization: "Bearer tk" },
    })
    expect(ctx.request.method).toBe("DELETE")
    expect(ctx.request.headers.get("Authorization")).toBe("Bearer tk")
  })

  test("runTestMiddleware returns response from handler", async () => {
    const passThrough: MiddlewareFn = async (_ctx, next) => next()
    const ctx = createTestContext("/test")
    const res = await runTestMiddleware(passThrough, ctx)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("OK")
  })

  test("runTestMiddleware can short-circuit", async () => {
    const blocker: MiddlewareFn = async () => new Response("Blocked", { status: 403 })
    const ctx = createTestContext("/test")
    const res = await runTestMiddleware(blocker, ctx)
    expect(res.status).toBe(403)
  })

  test("runTestMiddleware with custom handler", async () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const ctx = createTestContext("/test")
    const res = await runTestMiddleware(mw, ctx, async () => new Response("custom"))
    expect(await res.text()).toBe("custom")
  })

  test("testLoader calls loader with correct context", async () => {
    const loader = async (ctx: Context) => ({
      path: ctx.url.pathname,
      id: ctx.params.id ?? "none",
    })
    const result = await testLoader(loader, "/items/42", { params: { id: "42" } })
    expect(result.path).toBe("/items/42")
    expect(result.id).toBe("42")
  })

  test("testLoader with headers", async () => {
    const loader = async (ctx: Context) => ({
      auth: ctx.request.headers.get("Authorization"),
    })
    const result = await testLoader(loader, "/api", { headers: { Authorization: "Bearer x" } })
    expect(result.auth).toBe("Bearer x")
  })
})
