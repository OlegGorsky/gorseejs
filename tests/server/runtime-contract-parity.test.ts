import { describe, expect, test } from "bun:test"
import { dispatchRuntimeRequestPlan } from "../../src/server/runtime-dispatch.ts"
import {
  classifyRouteRequest,
  resolveRequestExecutionPolicy,
  type RequestAccess,
  type RequestMutation,
  type RequestResponseShape,
  type RouteRequestExecutionKind,
} from "../../src/server/request-policy.ts"

const routeModule = {
  async GET() {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  },
  async POST() {
    return new Response("updated")
  },
  async action() {
    return { ok: true }
  },
}

describe("runtime contract parity", () => {
  test("route request classification stays aligned with execution policy semantics", () => {
    expectKind("page", new Request("http://localhost/dashboard"), {
      access: "public",
      mutation: "read",
      responseShape: "document",
    })
    expectKind("partial", new Request("http://localhost/dashboard", {
      headers: {
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    }), {
      access: "internal",
      mutation: "read",
      responseShape: "data",
    })
    expectKind("action", new Request("http://localhost/dashboard", {
      method: "POST",
    }), {
      access: "public",
      mutation: "write",
      responseShape: "data",
    }, { action: routeModule.action })
    expectKind("route-handler", new Request("http://localhost/dashboard"), {
      access: "public",
      mutation: "write",
      responseShape: "raw",
    }, { GET: routeModule.GET })
  })

  test("runtime dispatch distinguishes route document and partial data responses consistently", async () => {
    const trace = { requestId: "req-1", traceId: "trace-1", spanId: "span-1" }
    const routePlan = ["route", "not-found"] as const

    const documentDispatch = await dispatchRuntimeRequestPlan({
      plan: [...routePlan],
      pathname: "/dashboard",
      request: new Request("http://localhost/dashboard"),
      trace,
      startTs: performance.now(),
      source: "runtime",
      handlers: {
        route: async () => new Response("<html></html>", {
          headers: { "Content-Type": "text/html" },
        }),
        "not-found": async () => new Response("missing", { status: 404 }),
      },
    })

    const partialDispatch = await dispatchRuntimeRequestPlan({
      plan: [...routePlan],
      pathname: "/dashboard",
      request: new Request("http://localhost/dashboard", {
        headers: {
          Accept: "application/json",
          "X-Gorsee-Navigate": "partial",
        },
      }),
      trace,
      startTs: performance.now(),
      source: "runtime",
      handlers: {
        route: async () => new Response(JSON.stringify({ html: "<main/>" }), {
          headers: { "Content-Type": "application/json" },
        }),
        "not-found": async () => new Response("missing", { status: 404 }),
      },
    })

    expect(documentDispatch?.surface).toBe("route")
    expect(partialDispatch?.surface).toBe("route")
    expect(documentDispatch?.response.headers.get("Content-Type")).toContain("text/html")
    expect(partialDispatch?.response.headers.get("Content-Type")).toContain("application/json")
  })
})

function expectKind(
  expectedKind: RouteRequestExecutionKind,
  request: Request,
  expected: {
    access: RequestAccess
    mutation: RequestMutation
    responseShape: RequestResponseShape
  },
  mod: Record<string, unknown> = {},
): void {
  const kind = classifyRouteRequest(mod, request)
  const policy = resolveRequestExecutionPolicy(kind)
  expect(kind).toBe(expectedKind)
  expect(policy.access).toBe(expected.access)
  expect(policy.mutation).toBe(expected.mutation)
  expect(policy.responseShape).toBe(expected.responseShape)
}
