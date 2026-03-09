import { describe, it, expect } from "bun:test"
import { createTestRequest, createTestContext, renderComponent, runTestMiddleware } from "../../src/testing/index.ts"
import type { MiddlewareFn } from "../../src/server/middleware.ts"

describe("Testing utilities", () => {
  it("createTestRequest creates request with defaults", () => {
    const req = createTestRequest("/api/users")
    expect(req.method).toBe("GET")
    expect(new URL(req.url).pathname).toBe("/api/users")
  })

  it("createTestRequest with options", () => {
    const req = createTestRequest("/api/users", {
      method: "POST",
      body: { name: "test" },
      headers: { "X-Custom": "value" },
    })
    expect(req.method).toBe("POST")
    expect(req.headers.get("Content-Type")).toBe("application/json")
    expect(req.headers.get("X-Custom")).toBe("value")
  })

  it("createTestContext creates context with params", () => {
    const ctx = createTestContext("/users/42", { params: { id: "42" } })
    expect(ctx.params.id).toBe("42")
    expect(ctx.url.pathname).toBe("/users/42")
  })

  it("renderComponent renders JSX to HTML string", () => {
    const Heading = (props: { text: string }) => ({
      type: "h1",
      props: { children: props.text },
    })
    const html = renderComponent(Heading, { text: "Hello" })
    expect(html).toContain("<h1>")
    expect(html).toContain("Hello")
  })

  it("runTestMiddleware runs middleware with default handler", async () => {
    const auth: MiddlewareFn = async (ctx, next) => {
      if (!ctx.request.headers.get("authorization")) {
        return new Response("Unauthorized", { status: 401 })
      }
      return next()
    }

    const ctx1 = createTestContext("/api")
    const res1 = await runTestMiddleware(auth, ctx1)
    expect(res1.status).toBe(401)

    const ctx2 = createTestContext("/api", { headers: { Authorization: "Bearer token" } })
    const res2 = await runTestMiddleware(auth, ctx2)
    expect(res2.status).toBe(200)
  })
})
