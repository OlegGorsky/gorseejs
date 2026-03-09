import { beforeEach, describe, expect, test } from "bun:test"
import { __registerRPC, __resetRPCState, handleRPCRequest } from "../../src/server/rpc.ts"

describe("rpc fuzz-like boundaries", () => {
  beforeEach(() => {
    __resetRPCState()
  })

  test("malformed request bodies fail closed without throwing", async () => {
    __registerRPC("rpctorture01", async () => ({ ok: true }))

    const bodies = [
      "{",
      "{\"x\":1}",
      "\"string\"",
      "null",
      "true",
      "[1,2",
      "[{\"a\":1}]".repeat(1000).slice(0, 2048),
    ]

    for (const body of bodies) {
      const response = await handleRPCRequest(new Request("http://localhost/api/_rpc/rpctorture01", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      }))

      expect(response).not.toBeNull()
      expect([400, 200]).toContain(response!.status)
    }
  })

  test("non-array parsed JSON is rejected consistently", async () => {
    __registerRPC("rpctorture02", async () => ({ ok: true }))
    const payloads = ["{}", "\"x\"", "1", "null", "true"]

    for (const body of payloads) {
      const response = await handleRPCRequest(new Request("http://localhost/api/_rpc/rpctorture02", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      }))

      expect(response).not.toBeNull()
      expect(response!.status).toBe(400)
      await expect(response!.json()).resolves.toMatchObject({
        v: 1,
        ok: false,
        error: "RPC args must be an array",
      })
    }
  })
})
