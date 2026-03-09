// Tests for RPC hash consistency

import { describe, test, expect } from "bun:test"
import { hashRPC, scanServerCalls } from "../../src/server/rpc-hash.ts"

describe("RPC hash", () => {
  test("hashRPC produces consistent 12-char hex", () => {
    const id = hashRPC("/routes/counter.tsx", 0)
    expect(id).toHaveLength(12)
    expect(id).toMatch(/^[a-f0-9]{12}$/)
  })

  test("same input produces same hash", () => {
    const a = hashRPC("/routes/counter.tsx", 0)
    const b = hashRPC("/routes/counter.tsx", 0)
    expect(a).toBe(b)
  })

  test("different index produces different hash", () => {
    const a = hashRPC("/routes/counter.tsx", 0)
    const b = hashRPC("/routes/counter.tsx", 1)
    expect(a).not.toBe(b)
  })

  test("different file produces different hash", () => {
    const a = hashRPC("/routes/a.tsx", 0)
    const b = hashRPC("/routes/b.tsx", 0)
    expect(a).not.toBe(b)
  })

  test("scanServerCalls finds server() calls", () => {
    const source = `
const fn1 = server(async () => {})
const fn2 = server(async (x) => x)
`
    const ids = scanServerCalls(source, "/test.ts")
    expect(ids).toHaveLength(2)
    expect(ids[0]).toHaveLength(12)
    expect(ids[0]).not.toBe(ids[1])
  })

  test("scanServerCalls returns empty for no server calls", () => {
    const ids = scanServerCalls("const x = 1", "/test.ts")
    expect(ids).toHaveLength(0)
  })
})
