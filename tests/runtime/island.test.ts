import { describe, it, expect } from "bun:test"
import { island, isIsland, ISLAND_MARKER } from "../../src/runtime/island.ts"
import { renderToString, ssrJsx } from "../../src/runtime/server.ts"

describe("island()", () => {
  function Counter(props: { count: number }) {
    return { type: "button", props: { children: `Count: ${props.count}` } }
  }

  it("marks component as island", () => {
    const IslandCounter = island(Counter)
    expect(isIsland(IslandCounter)).toBe(true)
    expect(IslandCounter.componentName).toBe("Counter")
    expect(IslandCounter[ISLAND_MARKER]).toBe(true)
  })

  it("renders with data-island attribute on server", () => {
    const IslandCounter = island(Counter)
    const vnode = ssrJsx(IslandCounter as any, { count: 5 })
    const html = renderToString(vnode)
    expect(html).toContain("data-island=\"Counter\"")
    expect(html).toContain("data-props=")
    expect(html).toContain("Count: 5")
  })

  it("serializes props as HTML-safe JSON", () => {
    const IslandCounter = island(Counter)
    const vnode = ssrJsx(IslandCounter as any, { count: 42 })
    const html = renderToString(vnode)
    // Props are double-escaped: island escapes " → &quot;, SSR escapes & → &amp;
    expect(html).toContain("data-props=")
    expect(html).toContain("count")
    expect(html).toContain("42")
  })

  it("adds data-island-lazy for lazy islands", () => {
    const LazyCounter = island(Counter, { lazy: true })
    const vnode = ssrJsx(LazyCounter as any, { count: 0 })
    const html = renderToString(vnode)
    expect(html).toContain("data-island-lazy")
  })

  it("strips non-serializable props (functions)", () => {
    function Widget(props: Record<string, unknown>) {
      return { type: "div", props: { children: String(props.label) } }
    }
    const IslandWidget = island(Widget)
    const vnode = ssrJsx(IslandWidget as any, { label: "Hello", onClick: () => {} })
    const html = renderToString(vnode)
    expect(html).toContain("Hello")
    expect(html).not.toContain("onClick")
  })

  it("isIsland returns false for regular functions", () => {
    expect(isIsland(Counter)).toBe(false)
    expect(isIsland(() => {})).toBe(false)
    expect(isIsland(null)).toBe(false)
  })
})
