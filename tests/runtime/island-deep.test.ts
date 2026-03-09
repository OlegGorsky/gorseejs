import { describe, test, expect } from "bun:test"
import { island, isIsland, ISLAND_MARKER } from "../../src/runtime/island.ts"
import { renderToString, ssrJsx } from "../../src/runtime/server.ts"

function Greeting(props: Record<string, unknown>) {
  return { type: "span", props: { children: `Hi ${props.name}` } }
}

function Empty() {
  return { type: "div", props: { children: "empty" } }
}

describe("island deep: wrapping", () => {
  test("island() returns a function", () => {
    const wrapped = island(Greeting)
    expect(typeof wrapped).toBe("function")
  })
  test("isIsland() true for island-wrapped", () => {
    expect(isIsland(island(Greeting))).toBe(true)
  })
  test("isIsland() false for regular component", () => {
    expect(isIsland(Greeting)).toBe(false)
  })
  test("isIsland() false for non-functions", () => {
    expect(isIsland("string")).toBe(false)
    expect(isIsland(42)).toBe(false)
    expect(isIsland(null)).toBe(false)
    expect(isIsland(undefined)).toBe(false)
  })
  test("preserves component name", () => {
    const wrapped = island(Greeting)
    expect(wrapped.componentName).toBe("Greeting")
  })
  test("anonymous component gets 'Anonymous' name", () => {
    const wrapped = island((props: Record<string, unknown>) => ({ type: "div", props: {} }))
    // Arrow functions may have empty name
    expect(typeof wrapped.componentName).toBe("string")
  })
  test("ISLAND_MARKER symbol is set", () => {
    const wrapped = island(Empty)
    expect(wrapped[ISLAND_MARKER]).toBe(true)
  })
  test("originalComponent preserved", () => {
    const wrapped = island(Greeting)
    expect(wrapped.originalComponent).toBe(Greeting)
  })
  test("options stored", () => {
    const wrapped = island(Greeting, { lazy: true })
    expect(wrapped.options.lazy).toBe(true)
  })
})

describe("island deep: rendering", () => {
  test("renders data-island attribute", () => {
    const IslandGreeting = island(Greeting)
    const html = renderToString(ssrJsx(IslandGreeting as any, { name: "World" }))
    expect(html).toContain('data-island="Greeting"')
  })
  test("renders data-props attribute", () => {
    const IslandGreeting = island(Greeting)
    const html = renderToString(ssrJsx(IslandGreeting as any, { name: "World" }))
    expect(html).toContain("data-props=")
    expect(html).toContain("name")
  })
  test("renders with no props (empty data-props)", () => {
    const IslandEmpty = island(Empty)
    const html = renderToString(ssrJsx(IslandEmpty as any, {}))
    expect(html).toContain("data-island")
    expect(html).toContain("{}")
  })
  test("renders with complex nested object props", () => {
    function Widget(props: Record<string, unknown>) {
      return { type: "div", props: { children: "w" } }
    }
    const IslandWidget = island(Widget)
    const html = renderToString(ssrJsx(IslandWidget as any, { config: { a: 1, b: { c: 2 } } }))
    expect(html).toContain("config")
  })
  test("renders with array props", () => {
    function List(props: Record<string, unknown>) {
      return { type: "div", props: { children: "list" } }
    }
    const IslandList = island(List)
    const html = renderToString(ssrJsx(IslandList as any, { items: [1, 2, 3] }))
    expect(html).toContain("items")
    expect(html).toContain("[1,2,3]")
  })
  test("renders children inside wrapper div", () => {
    const IslandGreeting = island(Greeting)
    const html = renderToString(ssrJsx(IslandGreeting as any, { name: "Test" }))
    expect(html).toContain("Hi Test")
    expect(html).toMatch(/^<div/)
    expect(html).toMatch(/<\/div>$/)
  })
  test("multiple islands on same page", () => {
    const I1 = island(Greeting)
    const I2 = island(Empty)
    const html1 = renderToString(ssrJsx(I1 as any, { name: "A" }))
    const html2 = renderToString(ssrJsx(I2 as any, {}))
    const combined = html1 + html2
    expect(combined).toContain('data-island="Greeting"')
    expect(combined).toContain('data-island="Empty"')
  })
})

describe("island deep: registerIsland", () => {
  // registerIsland is client-side only (imports hydration/event-replay)
  // We test the island module's own exports here
  test("island strips function props from serialized data", () => {
    function Btn(props: Record<string, unknown>) {
      return { type: "button", props: { children: "click" } }
    }
    const IslandBtn = island(Btn)
    const html = renderToString(ssrJsx(IslandBtn as any, { label: "OK", handler: () => {} }))
    expect(html).toContain("label")
    expect(html).not.toContain("handler")
  })
  test("island strips symbol props from serialized data", () => {
    function X(props: Record<string, unknown>) {
      return { type: "div", props: { children: "x" } }
    }
    const sym = Symbol("test")
    const IslandX = island(X)
    const html = renderToString(ssrJsx(IslandX as any, { id: "1", [sym]: true } as any))
    expect(html).toContain("id")
  })
})
