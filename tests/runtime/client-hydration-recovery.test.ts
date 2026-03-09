import { describe, expect, test } from "bun:test"
import { hydrate } from "../../src/runtime/client.ts"

class FakeNode {
  constructor(public label: string) {}
}

describe("client hydration recovery", () => {
  test("falls back to a full client render when hydration mismatches are detected", () => {
    const originalNode = globalThis.Node
    const originalConsoleWarn = console.warn
    const warnings: string[] = []
    let componentCalls = 0

    const container = {
      childNodes: [
        { nodeType: 1, tagName: "span", childNodes: [] as unknown[] },
      ],
      appended: [] as FakeNode[],
      replaceChildren() {
        this.childNodes = []
        this.appended = []
      },
      appendChild(node: FakeNode) {
        this.appended.push(node)
      },
    }

    ;(globalThis as Record<string, unknown>).Node = FakeNode
    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn

    try {
      hydrate(() => {
        componentCalls += 1
        return new FakeNode(`render-${componentCalls}`) as unknown as Node
      }, container as unknown as Element)

      expect(componentCalls).toBe(2)
      expect(container.appended).toHaveLength(1)
      expect(container.appended[0]?.label).toBe("render-2")
      expect(warnings.join("\n")).toContain("Hydration completed with 1 mismatch")
    } finally {
      ;(globalThis as Record<string, unknown>).Node = originalNode
      console.warn = originalConsoleWarn
    }
  })
})
