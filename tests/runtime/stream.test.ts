import { describe, test, expect } from "bun:test"
import {
  renderToStream,
  streamJsx as h,
  StreamSuspense,
} from "../../src/runtime/stream.ts"
import { createSignal } from "../../src/reactive/signal.ts"

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let result = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value)
  }
  return result
}

describe("renderToStream", () => {
  test("streams simple element", async () => {
    const vnode = h("div", { children: "hello" })
    const html = await collectStream(renderToStream(vnode))
    expect(html).toContain("<div>hello</div>")
    expect(html).toContain("</html>")
  })

  test("streams nested elements", async () => {
    const vnode = h("main", {
      children: [
        h("h1", { children: "Title" }),
        h("p", { children: "Content" }),
      ],
    })
    const html = await collectStream(renderToStream(vnode))
    expect(html).toContain("<main><h1>Title</h1><p>Content</p></main>")
  })

  test("streams signals (reads current value)", async () => {
    const [count] = createSignal(42)
    const vnode = h("span", { children: count })
    const html = await collectStream(renderToStream(vnode))
    expect(html).toContain("<span>42</span>")
  })

  test("streams Suspense with sync children", async () => {
    const suspense = StreamSuspense({
      fallback: h("div", { children: "Loading..." }),
      children: h("div", { children: "Loaded!" }),
    })

    const root = h("main", { children: suspense })
    const html = await collectStream(renderToStream(root))

    // Should contain the resolved content
    expect(html).toContain("Loaded!")
    // Should contain the swap script
    expect(html).toContain("data-g-chunk")
  })

  test("streams Suspense with async children", async () => {
    const suspense = StreamSuspense({
      fallback: h("p", { children: "Loading users..." }),
      children: async () => {
        // Simulate async data fetch
        await new Promise((r) => setTimeout(r, 10))
        return h("ul", {
          children: [
            h("li", { children: "Alice" }),
            h("li", { children: "Bob" }),
          ],
        })
      },
    })

    const root = h("div", { children: [h("h1", { children: "Users" }), suspense] })
    const html = await collectStream(renderToStream(root))

    // Shell should have fallback
    expect(html).toContain("data-g-suspense")
    // Resolved chunk should have content
    expect(html).toContain("Alice")
    expect(html).toContain("Bob")
    // Should have swap script
    expect(html).toContain("<script>")
    expect(html).toContain("data-g-chunk")
  })

  test("streams multiple Suspense boundaries", async () => {
    const fast = StreamSuspense({
      fallback: h("div", { children: "Loading fast..." }),
      children: async () => {
        await new Promise((r) => setTimeout(r, 5))
        return h("div", { children: "Fast data" })
      },
    })

    const slow = StreamSuspense({
      fallback: h("div", { children: "Loading slow..." }),
      children: async () => {
        await new Promise((r) => setTimeout(r, 20))
        return h("div", { children: "Slow data" })
      },
    })

    const root = h("main", { children: [fast, slow] })
    const html = await collectStream(renderToStream(root))

    expect(html).toContain("Fast data")
    expect(html).toContain("Slow data")
    // Both chunks should be present
    const chunkMatches = html.match(/<template data-g-chunk/g)
    expect(chunkMatches?.length).toBe(2)
  })

  test("handles Suspense error gracefully", async () => {
    const errSuspense = StreamSuspense({
      fallback: h("div", { children: "Loading..." }),
      children: async () => {
        throw new Error("Data fetch failed")
      },
    })

    const root = h("div", { children: errSuspense })
    const html = await collectStream(renderToStream(root))

    expect(html).toContain("Error: Data fetch failed")
  })

  test("custom shell wrapper", async () => {
    const vnode = h("h1", { children: "Hello" })
    const html = await collectStream(
      renderToStream(vnode, {
        shell: (body) => `<html><body>${body}`,
      })
    )
    expect(html).toStartWith("<html><body>")
    expect(html).toContain("<h1>Hello</h1>")
  })

  test("component rendering in stream", async () => {
    function Greeting(props: { name: string }) {
      return h("h1", { children: `Hello, ${props.name}!` })
    }

    const vnode = h(Greeting as any, { name: "World" })
    const html = await collectStream(renderToStream(vnode))
    expect(html).toContain("<h1>Hello, World!</h1>")
  })
})
