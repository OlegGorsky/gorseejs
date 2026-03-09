import { describe, test, expect } from "bun:test"
import { transformServerCalls } from "../../src/build/rpc-transform.ts"
import { hashRPC } from "../../src/server/rpc-hash.ts"

const FILE = "/routes/counter.tsx"

describe("rpc-transform-deep", () => {
  test("transforms server() call to fetch stub", () => {
    const src = `const inc = server(async (n: number) => n + 1)`
    const out = transformServerCalls(src, FILE)
    expect(out).toContain("fetch")
    expect(out).not.toContain("server(async")
  })

  test("RPC URL includes correct hash", () => {
    const src = `const fn = server(async () => 42)`
    const out = transformServerCalls(src, FILE)
    const expectedHash = hashRPC(FILE, 0)
    expect(out).toContain(`/api/_rpc/${expectedHash}`)
  })

  test("multiple server() calls each get unique hash", () => {
    const src = [
      `const a = server(async () => 1)`,
      `const b = server(async () => 2)`,
    ].join("\n")
    const out = transformServerCalls(src, FILE)
    const h0 = hashRPC(FILE, 0)
    const h1 = hashRPC(FILE, 1)
    expect(out).toContain(h0)
    expect(out).toContain(h1)
    expect(h0).not.toBe(h1)
  })

  test("preserves non-server code", () => {
    const src = `const x = 42\nconst fn = server(async () => x)\nconst y = x + 1`
    const out = transformServerCalls(src, FILE)
    expect(out).toContain("const x = 42")
    expect(out).toContain("const y = x + 1")
  })

  test("generated stub uses POST method", () => {
    const src = `const fn = server(async () => {})`
    const out = transformServerCalls(src, FILE)
    expect(out).toContain(`method: "POST"`)
  })

  test("generated stub sends JSON body", () => {
    const src = `const fn = server(async (a: string) => a)`
    const out = transformServerCalls(src, FILE)
    expect(out).toContain("Content-Type")
    expect(out).toContain("application/vnd.gorsee-rpc+json")
    expect(out).toContain("JSON.stringify")
    expect(out).toContain("v: 1")
  })

  test("no server() calls returns source unchanged", () => {
    const src = `export default function Page() { return 'hi' }`
    const out = transformServerCalls(src, FILE)
    expect(out).toBe(src)
  })

  test("stub throws on non-ok response", () => {
    const src = `const fn = server(async () => 1)`
    const out = transformServerCalls(src, FILE)
    expect(out).toContain("throw new Error")
    expect(out).toContain("RPC failed")
  })

  test("adds devalue parse import", () => {
    const src = `const fn = server(async () => 1)`
    const out = transformServerCalls(src, FILE)
    expect(out).toContain("import { parse as __gorseeDevalParse }")
  })

  test("generated stub validates RPC envelope", () => {
    const src = `const fn = server(async () => 1)`
    const out = transformServerCalls(src, FILE)
    expect(out).toContain("payload.ok !== true")
    expect(out).toContain('payload.encoding !== "devalue"')
    expect(out).toContain("RPC protocol mismatch")
  })

  test("strips type annotations from args", () => {
    const src = `const fn = server(async (count: number, name: string) => count)`
    const out = transformServerCalls(src, FILE)
    // Should have args without type annotations
    expect(out).toContain("count, name")
    expect(out).not.toContain("count: number")
  })

  test("handles function keyword syntax", () => {
    const src = `const fn = server(function doStuff() { return 1 })`
    // function keyword without async won't match the regex "async\s|function\s"
    // Actually it will because the regex matches "function\s"
    const out = transformServerCalls(src, FILE)
    expect(out).toContain("fetch")
  })

  test("different file paths produce different RPC URLs", () => {
    const src = `const fn = server(async () => 1)`
    const out1 = transformServerCalls(src, "/routes/a.tsx")
    const out2 = transformServerCalls(src, "/routes/b.tsx")
    const h1 = hashRPC("/routes/a.tsx", 0)
    const h2 = hashRPC("/routes/b.tsx", 0)
    expect(out1).toContain(h1)
    expect(out2).toContain(h2)
    expect(h1).not.toBe(h2)
  })
})
