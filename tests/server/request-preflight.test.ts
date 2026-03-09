import { describe, expect, test } from "bun:test"
import { createAuth } from "../../src/auth/index.ts"
import { createCSRFMiddleware, csrfProtection } from "../../src/security/csrf.ts"
import { createContext } from "../../src/server/middleware.ts"
import { handleRPCRequestWithPolicy } from "../../src/server/request-preflight.ts"
import { __registerRPC, __resetRPCState } from "../../src/server/rpc.ts"
import { RPC_CONTENT_TYPE } from "../../src/server/rpc-protocol.ts"

describe("handleRPCRequestWithPolicy", () => {
  test("returns null for non-RPC paths without running middleware", async () => {
    let called = false
    const response = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/users"),
      {
        middlewares: [async (_ctx, next) => {
          called = true
          return next()
        }],
      },
    )

    expect(response).toBeNull()
    expect(called).toBe(false)
  })

  test("supports auth middleware chains for RPC endpoints", async () => {
    __resetRPCState()
    __registerRPC("rpcauthcheck", async () => ({ ok: true }))

    const auth = createAuth({ secret: "rpc-secret" })
    const ctx = createContext(new Request("http://localhost/login"))
    await auth.login(ctx, "user-1")
    const sessionCookie = ctx.responseHeaders.get("Set-Cookie")!.split(";")[0]!

    const denied = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/_rpc/rpcauthcheck", {
        method: "POST",
        body: JSON.stringify([]),
        headers: { "Content-Type": "application/json" },
      }),
      { middlewares: [auth.middleware, auth.requireAuth] },
    )

    expect(denied).not.toBeNull()
    expect(denied!.status).toBe(302)
    expect(denied!.headers.get("Location")).toBe("/login")

    const allowed = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/_rpc/rpcauthcheck", {
        method: "POST",
        body: JSON.stringify([]),
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
      }),
      { middlewares: [auth.middleware, auth.requireAuth] },
    )

    expect(allowed).not.toBeNull()
    expect(allowed!.status).toBe(200)
  })

  test("supports CSRF middleware for RPC endpoints", async () => {
    __resetRPCState()
    __registerRPC("rpccsrfcheck", async () => ({ ok: true }))

    const csrf = await csrfProtection("rpc-csrf-secret")

    const denied = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/_rpc/rpccsrfcheck", {
        method: "POST",
        body: JSON.stringify([]),
        headers: { "Content-Type": "application/json" },
      }),
      { middlewares: [createCSRFMiddleware("rpc-csrf-secret")] },
    )

    expect(denied).not.toBeNull()
    expect(denied!.status).toBe(403)

    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!
    const allowed = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/_rpc/rpccsrfcheck", {
        method: "POST",
        body: JSON.stringify([]),
        headers: {
          "Content-Type": "application/json",
          cookie: `__gorsee_csrf=${cookieValue}`,
          "x-gorsee-csrf": csrf.token,
        },
      }),
      { middlewares: [createCSRFMiddleware("rpc-csrf-secret")] },
    )

    expect(allowed).not.toBeNull()
    expect(allowed!.status).toBe(200)
  })

  test("accepts the versioned RPC content type", async () => {
    __resetRPCState()
    __registerRPC("rpcvendor123", async () => ({ ok: true }))

    const response = await handleRPCRequestWithPolicy(
      new Request("https://app.example.com/api/_rpc/rpcvendor123", {
        method: "POST",
        body: JSON.stringify({ v: 1, args: [] }),
        headers: {
          "Content-Type": RPC_CONTENT_TYPE,
          Origin: "https://app.example.com",
        },
      }),
      { trustedOrigin: "https://app.example.com" },
    )

    expect(response).not.toBeNull()
    expect(response!.status).toBe(200)
    expect(response!.headers.get("Content-Type")).toBe(RPC_CONTENT_TYPE)
  })

  test("rejects cross-origin RPC requests before middleware execution", async () => {
    __resetRPCState()
    __registerRPC("rpcoriginchk1", async () => ({ ok: true }))

    const response = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/_rpc/rpcoriginchk1", {
        method: "POST",
        body: JSON.stringify([]),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
        },
      }),
      { trustedOrigin: "https://app.example.com" },
    )

    expect(response).not.toBeNull()
    expect(response!.status).toBe(403)
  })

  test("rejects RPC requests with unsupported content type", async () => {
    __resetRPCState()
    __registerRPC("rpccontent12", async () => ({ ok: true }))

    const response = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/_rpc/rpccontent12", {
        method: "POST",
        body: "x",
        headers: {
          "Content-Type": "text/plain",
          Origin: "https://app.example.com",
        },
      }),
      { trustedOrigin: "https://app.example.com" },
    )

    expect(response).not.toBeNull()
    expect(response!.status).toBe(415)
  })

  test("attaches the same request contract to RPC middleware locals as route execution", async () => {
    __resetRPCState()
    __registerRPC("rpclocals123", async () => ({ ok: true }))

    let seen:
      | {
        requestKind?: unknown
        requestAccess?: unknown
        requestMutation?: unknown
        requestResponseShape?: unknown
        requestEffectiveOrigin?: unknown
        requestId?: unknown
        traceId?: unknown
        spanId?: unknown
      }
      | undefined

    const response = await handleRPCRequestWithPolicy(
      new Request("https://app.example.com/api/_rpc/rpclocals123", {
        method: "POST",
        body: JSON.stringify([]),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://app.example.com",
        },
      }),
      {
        trustedOrigin: "https://app.example.com",
        middlewares: [async (ctx, next) => {
          seen = {
            requestKind: ctx.locals.requestKind,
            requestAccess: ctx.locals.requestAccess,
            requestMutation: ctx.locals.requestMutation,
            requestResponseShape: ctx.locals.requestResponseShape,
            requestEffectiveOrigin: ctx.locals.requestEffectiveOrigin,
            requestId: ctx.locals.requestId,
            traceId: ctx.locals.traceId,
            spanId: ctx.locals.spanId,
          }
          return next()
        }],
      },
    )

    expect(response).not.toBeNull()
    expect(response!.status).toBe(200)
    expect(seen).toEqual({
      requestKind: "rpc",
      requestAccess: "internal",
      requestMutation: "write",
      requestResponseShape: "data",
      requestEffectiveOrigin: "https://app.example.com",
      requestId: expect.any(String),
      traceId: expect.any(String),
      spanId: expect.any(String),
    })
  })

  test("rejects RPC requests from untrusted forwarded host when proxy trust is enabled", async () => {
    __resetRPCState()
    __registerRPC("rpchostcheck1", async () => ({ ok: true }))

    const response = await handleRPCRequestWithPolicy(
      new Request("http://localhost/api/_rpc/rpchostcheck1", {
        method: "POST",
        body: JSON.stringify([]),
        headers: {
          "Content-Type": "application/json",
          Host: "localhost",
          "X-Forwarded-Host": "evil.example",
          "X-Forwarded-Proto": "https",
          Origin: "https://app.example.com",
        },
      }),
      {
        securityPolicy: {
          trustedOrigin: "https://app.example.com",
          trustForwardedHeaders: true,
          trustedForwardedHops: 1,
          trustedHosts: ["app.example.com"],
          enforceTrustedHosts: true,
        },
      },
    )

    expect(response).not.toBeNull()
    expect(response!.status).toBe(400)
  })
})
