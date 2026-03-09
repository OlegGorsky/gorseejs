import { describe, expect, test } from "bun:test"
import { replaceHTMLFragment } from "../../src/runtime/router.ts"
import { buildStreamChunkScript } from "../../src/runtime/stream.ts"

describe("router DOM update contract", () => {
  test("replaceHTMLFragment swaps DOM without direct container innerHTML assignment", () => {
    const originalDocument = globalThis.document
    const fakeNodes = [{ kind: "section" }, { kind: "span" }]
    const container = {
      received: [] as unknown[],
      replaceChildren(...nodes: unknown[]) {
        this.received = nodes
      },
    }

    ;(globalThis as Record<string, unknown>).document = {
      createElement(tag: string) {
        expect(tag).toBe("template")
        return {
          content: { childNodes: fakeNodes },
          set innerHTML(_html: string) {},
        }
      },
    }

    try {
      replaceHTMLFragment(container as unknown as Element, `<section data-test="next"><span>new</span></section>`)
      expect(container.received).toEqual(fakeNodes)
    } finally {
      ;(globalThis as Record<string, unknown>).document = originalDocument
    }
  })

  test("stream chunk patch script uses replaceChildren rather than innerHTML writes", () => {
    const script = buildStreamChunkScript("slot-a", "<div>chunk</div>")
    expect(script).toContain("replaceChildren")
    expect(script).not.toContain(".innerHTML=")
  })

  test("stale stream chunk script noops when the suspense boundary is gone", () => {
    const originalDocument = globalThis.document
    const script = buildStreamChunkScript("slot-a", "<div>chunk</div>")
    const js = script.match(/<script>([\s\S]*)<\/script>/)?.[1]
    expect(js).toBeTruthy()

    let templateRemoved = false
    const template = {
      content: {
        cloneNode() {
          return { childNodes: [{ kind: "chunk" }] }
        },
      },
      remove() {
        templateRemoved = true
      },
    }

    ;(globalThis as Record<string, unknown>).document = {
      querySelector(selector: string) {
        if (selector === '[data-g-chunk="slot-a"]') return template
        if (selector === '[data-g-suspense="slot-a"]') return null
        return null
      },
    }

    try {
      expect(() => Function(String(js))()).not.toThrow()
      expect(templateRemoved).toBe(false)
    } finally {
      ;(globalThis as Record<string, unknown>).document = originalDocument
    }
  })
})
