import { describe, test, expect, beforeEach } from "bun:test"
import { hashRPC, scanServerCalls } from "../../src/server/rpc-hash.ts"
import {
  __registerRPC,
  __resetRPCState,
  createMemoryRPCRegistry,
  getRPCHandler,
  handleRPCRequest,
  handleRPCRequestWithRegistry,
} from "../../src/server/rpc.ts"
import { RPC_CONTENT_TYPE } from "../../src/server/rpc-protocol.ts"

beforeEach(() => __resetRPCState())

describe("hashRPC", () => {
  test("deterministic: same input -> same output", () => {
    const a = hashRPC("/src/routes/index.tsx", 0)
    const b = hashRPC("/src/routes/index.tsx", 0)
    expect(a).toBe(b)
  })

  test("different file -> different hash", () => {
    const a = hashRPC("/a.tsx", 0)
    const b = hashRPC("/b.tsx", 0)
    expect(a).not.toBe(b)
  })

  test("different index -> different hash", () => {
    const a = hashRPC("/file.tsx", 0)
    const b = hashRPC("/file.tsx", 1)
    expect(a).not.toBe(b)
  })

  test("hash is 12 hex characters", () => {
    const h = hashRPC("/test.tsx", 0)
    expect(h).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe("scanServerCalls", () => {
  test("finds server() calls with async", () => {
    const source = `const fn = server(async () => {}); const fn2 = server(async () => {});`
    const hashes = scanServerCalls(source, "/test.tsx")
    expect(hashes).toHaveLength(2)
    expect(hashes[0]).toBe(hashRPC("/test.tsx", 0))
    expect(hashes[1]).toBe(hashRPC("/test.tsx", 1))
  })
})

describe("RPC registry", () => {
  test("__registerRPC stores handler", () => {
    const fn = async () => "result"
    __registerRPC("abc123", fn)
    expect(getRPCHandler("abc123")).toBe(fn)
  })

  test("getRPCHandler returns undefined for unknown id", () => {
    expect(getRPCHandler("nonexistent")).toBeUndefined()
  })

  test("multiple registrations coexist", () => {
    const fn1 = async () => "one"
    const fn2 = async () => "two"
    __registerRPC("id1", fn1)
    __registerRPC("id2", fn2)
    expect(getRPCHandler("id1")).toBe(fn1)
    expect(getRPCHandler("id2")).toBe(fn2)
  })

  test("__resetRPCState clears all handlers", () => {
    __registerRPC("test", async () => null)
    __resetRPCState()
    expect(getRPCHandler("test")).toBeUndefined()
  })
})

describe("handleRPCRequest", () => {
  test("returns null for non-RPC paths", async () => {
    const req = new Request("http://localhost/api/users")
    expect(await handleRPCRequest(req)).toBeNull()
  })

  test("returns 404 for unknown handler", async () => {
    const req = new Request("http://localhost/api/_rpc/unknownhash", { method: "POST" })
    const res = await handleRPCRequest(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(404)
  })

  test("rejects non-POST methods for RPC endpoints", async () => {
    __registerRPC("getisblocked", async () => ({ ok: true }))
    const req = new Request("http://localhost/api/_rpc/getisblocked", { method: "GET" })
    const res = await handleRPCRequest(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(405)
    expect(res!.headers.get("Allow")).toBe("POST")
  })

  test("calls registered handler with POST args", async () => {
    __registerRPC("abc123abc123", async (a: unknown, b: unknown) => {
      return { sum: (a as number) + (b as number) }
    })
    const req = new Request("http://localhost/api/_rpc/abc123abc123", {
      method: "POST",
      body: JSON.stringify([1, 2]),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(200)
    expect(res!.headers.get("Content-Type")).toBe(RPC_CONTENT_TYPE)
    const body = await res!.json() as { v: number; ok: boolean; encoding: string; data: string }
    expect(body.ok).toBe(true)
    expect(body.v).toBe(1)
    expect(body.encoding).toBe("devalue")
  })

  test("returns 400 for non-array body", async () => {
    __registerRPC("handler123ab", async () => null)
    const req = new Request("http://localhost/api/_rpc/handler123ab", {
      method: "POST",
      body: JSON.stringify({ not: "array" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(400)
  })

  test("returns 400 for invalid JSON", async () => {
    __registerRPC("handler456ab", async () => null)
    const req = new Request("http://localhost/api/_rpc/handler456ab", {
      method: "POST",
      body: "not json{{{",
      headers: { "Content-Type": "application/json", "Content-Length": "11" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(400)
  })

  test("returns 500 when handler throws", async () => {
    __registerRPC("throwhandlr", async () => { throw new Error("oops") })
    const req = new Request("http://localhost/api/_rpc/throwhandlr", {
      method: "POST",
      body: JSON.stringify([]),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(500)
    const body = await res!.json() as { v: number; ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.v).toBe(1)
    expect(body.error).toBe("oops")
  })

  test("returns 413 when actual body exceeds limit even without oversized Content-Length", async () => {
    __registerRPC("toobigbody12", async () => ({ ok: true }))
    const oversized = `[${"\"x\"".repeat(400_000)}]`
    const req = new Request("http://localhost/api/_rpc/toobigbody12", {
      method: "POST",
      body: oversized,
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(413)
  })

  test("returns 413 when serialized RPC result exceeds limit", async () => {
    __registerRPC("bigresult1234", async () => "x".repeat(1024 * 1024 + 8))
    const req = new Request("http://localhost/api/_rpc/bigresult1234", {
      method: "POST",
      body: JSON.stringify([]),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(413)
    const body = await res!.json() as { v: number; ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("Response body too large")
  })

  test("returns 500 when RPC result cannot be serialized safely", async () => {
    __registerRPC("badserial123", async () => ({ fn: () => "nope" }))
    const req = new Request("http://localhost/api/_rpc/badserial123", {
      method: "POST",
      body: JSON.stringify([]),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(500)
    const body = await res!.json() as { v: number; ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(typeof body.error).toBe("string")
    expect(body.error.length).toBeGreaterThan(0)
  })

  test("handleRPCRequestWithRegistry resolves handlers from injected registry", async () => {
    const registry = createMemoryRPCRegistry()
    registry.setHandler("customrpc123", async () => ({ ok: true }))
    const req = new Request("http://localhost/api/_rpc/customrpc123", {
      method: "POST",
      body: JSON.stringify([]),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequestWithRegistry(req, registry)
    expect(res!.status).toBe(200)
  })

  test("accepts versioned RPC request envelopes", async () => {
    __registerRPC("envproto1234", async (a: unknown, b: unknown) => ({ sum: Number(a) + Number(b) }))
    const req = new Request("http://localhost/api/_rpc/envproto1234", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [2, 5] }),
      headers: { "Content-Type": RPC_CONTENT_TYPE },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(200)
    const body = await res!.json() as { ok: boolean; v: number }
    expect(body.ok).toBe(true)
    expect(body.v).toBe(1)
  })
})
