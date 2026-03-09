import { describe, test, expect, beforeEach } from "bun:test"
import { Head, resetServerHead, getServerHead } from "../../src/runtime/head.ts"

describe("Head component (server-side)", () => {
  beforeEach(() => {
    resetServerHead()
  })

  test("collects title element", () => {
    Head({ children: { type: "title", props: { children: "My Page" } } })
    expect(getServerHead()).toEqual(["<title>My Page</title>"])
  })

  test("collects meta element", () => {
    Head({ children: { type: "meta", props: { name: "description", content: "A test page" } } })
    expect(getServerHead()).toEqual([`<meta name="description" content="A test page" />`])
  })

  test("collects link element", () => {
    Head({ children: { type: "link", props: { rel: "canonical", href: "https://example.com" } } })
    expect(getServerHead()).toEqual([`<link rel="canonical" href="https://example.com" />`])
  })

  test("collects multiple elements", () => {
    Head({
      children: [
        { type: "title", props: { children: "Page Title" } },
        { type: "meta", props: { name: "viewport", content: "width=device-width" } },
      ],
    })
    expect(getServerHead()).toHaveLength(2)
    expect(getServerHead()[0]).toBe("<title>Page Title</title>")
  })

  test("resetServerHead clears collected elements", () => {
    Head({ children: { type: "title", props: { children: "Test" } } })
    expect(getServerHead()).toHaveLength(1)
    resetServerHead()
    expect(getServerHead()).toHaveLength(0)
  })

  test("returns null", () => {
    const result = Head({ children: { type: "title", props: { children: "X" } } })
    expect(result).toBeNull()
  })
})
