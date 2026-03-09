import { describe, test, expect } from "bun:test"
import { renderToStream, streamJsx as h, StreamSuspense } from "../../src/runtime/stream.ts"
import { Fragment } from "../../src/runtime/jsx-runtime.ts"

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

describe("renderToStream deep", () => {
  test("returns ReadableStream instance", () => {
    const stream = renderToStream(h("div", { children: "hi" }))
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  test("renders basic HTML content", async () => {
    const html = await collectStream(renderToStream(h("p", { children: "text" })))
    expect(html).toContain("<p>text</p>")
  })

  test("includes default shell wrapper with DOCTYPE", async () => {
    const html = await collectStream(renderToStream(h("div", { children: "x" })))
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("<html")
    expect(html).toContain('<div id="app">')
  })

  test("stream completes (reader done=true)", async () => {
    const stream = renderToStream(h("div", { children: "ok" }))
    const reader = stream.getReader()
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
    }
    expect(done).toBe(true)
  })

  test("contains valid HTML structure with closing tags", async () => {
    const html = await collectStream(renderToStream(h("div", { children: "x" })))
    expect(html).toContain("</body>")
    expect(html).toContain("</html>")
  })

  test("handles nested components", async () => {
    function Card(props: { title: string }) {
      return h("div", { class: "card", children: h("h2", { children: props.title }) })
    }
    const html = await collectStream(renderToStream(h(Card as any, { title: "Hello" })))
    expect(html).toContain('<div class="card"><h2>Hello</h2></div>')
  })

  test("handles large content (1000 items)", async () => {
    const items = Array.from({ length: 1000 }, (_, i) => h("li", { children: `Item ${i}` }))
    const html = await collectStream(renderToStream(h("ul", { children: items })))
    expect(html).toContain("Item 0")
    expect(html).toContain("Item 999")
  })

  test("handles async component in Suspense with error", async () => {
    const sus = StreamSuspense({
      fallback: h("span", { children: "wait" }),
      children: async () => { throw new Error("boom") },
    })
    const html = await collectStream(renderToStream(h("div", { children: sus })))
    expect(html).toContain("Error: boom")
  })

  test("handles fragment children", async () => {
    const frag = h(Fragment as any, { children: [h("a", { children: "1" }), h("b", { children: "2" })] })
    const html = await collectStream(renderToStream(h("div", { children: frag })))
    expect(html).toContain("<a>1</a><b>2</b>")
  })

  test("escapes text content in stream", async () => {
    const html = await collectStream(renderToStream(h("div", { children: "<script>xss</script>" })))
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>xss</script>")
  })

  test("void elements rendered correctly in stream", async () => {
    const html = await collectStream(renderToStream(h("div", { children: h("br", {}) })))
    expect(html).toContain("<br />")
  })

  test("boolean attributes in stream", async () => {
    const html = await collectStream(renderToStream(h("input", { disabled: true, type: "text" })))
    expect(html).toContain("disabled")
    expect(html).toContain('type="text"')
  })

  test("null/undefined children in stream are skipped", async () => {
    const html = await collectStream(renderToStream(h("div", { children: [null, "ok", undefined] })))
    expect(html).toContain("<div>ok</div>")
  })

  test("stream with multiple sync Suspense boundaries", async () => {
    const s1 = StreamSuspense({ fallback: h("span", { children: "f1" }), children: h("b", { children: "r1" }) })
    const s2 = StreamSuspense({ fallback: h("span", { children: "f2" }), children: h("b", { children: "r2" }) })
    const html = await collectStream(renderToStream(h("div", { children: [s1, s2] })))
    expect(html).toContain("r1")
    expect(html).toContain("r2")
  })

  test("on:click handlers stripped from stream output", async () => {
    const html = await collectStream(renderToStream(h("button", { "on:click": () => {}, children: "go" })))
    expect(html).not.toContain("on:click")
    expect(html).toContain("go")
  })
})
