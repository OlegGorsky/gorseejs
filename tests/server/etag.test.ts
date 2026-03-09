import { describe, it, expect } from "bun:test"
import { generateETag, isNotModified } from "../../src/server/etag.ts"

describe("ETag", () => {
  it("generates weak ETag from size and mtime", () => {
    const etag = generateETag(1024, 1709654400000)
    expect(etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/)
    // Verify deterministic: same inputs → same output
    expect(etag).toBe(generateETag(1024, 1709654400000))
  })

  it("generates different ETags for different files", () => {
    const a = generateETag(1024, 1709654400000)
    const b = generateETag(2048, 1709654400000)
    const c = generateETag(1024, 1709654500000)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it("isNotModified returns true when If-None-Match matches", () => {
    const etag = 'W/"400-18e1f68a400"'
    const req = new Request("http://localhost/file.css", {
      headers: { "If-None-Match": etag },
    })
    expect(isNotModified(req, etag)).toBe(true)
  })

  it("isNotModified returns false when no If-None-Match header", () => {
    const req = new Request("http://localhost/file.css")
    expect(isNotModified(req, 'W/"400-18e1f68a400"')).toBe(false)
  })

  it("isNotModified handles comma-separated ETags", () => {
    const etag = 'W/"400-18e1f68a400"'
    const req = new Request("http://localhost/file.css", {
      headers: { "If-None-Match": `W/"other-tag", ${etag}, W/"another"` },
    })
    expect(isNotModified(req, etag)).toBe(true)
  })
})
