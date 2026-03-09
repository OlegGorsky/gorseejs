import { describe, test, expect } from "bun:test"
import { ssrJsx as h, renderToString } from "../../src/runtime/server.ts"
import { createSignal } from "../../src/reactive/signal.ts"
import { createComputed } from "../../src/reactive/computed.ts"
import { Fragment } from "../../src/runtime/jsx-runtime.ts"

describe("renderToString", () => {
  test("renders simple element", () => {
    const vnode = h("div", { children: "hello" })
    expect(renderToString(vnode)).toBe("<div>hello</div>")
  })

  test("renders nested elements", () => {
    const vnode = h("div", {
      children: h("span", { children: "inner" }),
    })
    expect(renderToString(vnode)).toBe("<div><span>inner</span></div>")
  })

  test("renders attributes", () => {
    const vnode = h("a", { href: "/about", class: "link", children: "click" })
    expect(renderToString(vnode)).toBe('<a href="/about" class="link">click</a>')
  })

  test("renders boolean attributes", () => {
    const vnode = h("input", { disabled: true, type: "text" })
    expect(renderToString(vnode)).toBe('<input disabled type="text" />')
  })

  test("skips false boolean attributes", () => {
    const vnode = h("input", { disabled: false, type: "text" })
    expect(renderToString(vnode)).toBe('<input type="text" />')
  })

  test("renders void elements", () => {
    const vnode = h("br", {})
    expect(renderToString(vnode)).toBe("<br />")
  })

  test("renders array children", () => {
    const items = ["a", "b", "c"]
    const vnode = h("ul", {
      children: items.map((item) => h("li", { children: item })),
    })
    expect(renderToString(vnode)).toBe("<ul><li>a</li><li>b</li><li>c</li></ul>")
  })

  test("escapes HTML in text content", () => {
    const vnode = h("div", { children: '<script>alert("xss")</script>' })
    expect(renderToString(vnode)).toBe(
      "<div>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</div>"
    )
  })

  test("escapes HTML in attributes", () => {
    const vnode = h("div", { title: 'say "hello"', children: "ok" })
    expect(renderToString(vnode)).toBe('<div title="say &quot;hello&quot;">ok</div>')
  })

  test("renders Fragment", () => {
    const vnode = h(Fragment, {
      children: [h("span", { children: "a" }), h("span", { children: "b" })],
    })
    expect(renderToString(vnode)).toBe("<span>a</span><span>b</span>")
  })

  test("renders component function", () => {
    function Greeting(props: { name: string }) {
      return h("h1", { children: `Hello, ${props.name}!` })
    }
    const vnode = h(Greeting as any, { name: "World" })
    expect(renderToString(vnode)).toBe("<h1>Hello, World!</h1>")
  })

  test("renders signals (reads current value)", () => {
    const [count] = createSignal(42)
    const vnode = h("span", { children: count })
    expect(renderToString(vnode)).toBe("<span>42</span>")
  })

  test("renders computed values", () => {
    const [count] = createSignal(5)
    const doubled = createComputed(() => count() * 2)
    const vnode = h("span", { children: doubled })
    expect(renderToString(vnode)).toBe("<span>10</span>")
  })

  test("renders signal in attributes", () => {
    const [cls] = createSignal("active")
    const vnode = h("div", { class: cls, children: "ok" })
    expect(renderToString(vnode)).toBe('<div class="active">ok</div>')
  })

  test("skips event handlers in SSR", () => {
    const vnode = h("button", { "on:click": () => {}, children: "click me" })
    expect(renderToString(vnode)).toBe("<button>click me</button>")
  })

  test("renders null/undefined/boolean children as empty", () => {
    const vnode = h("div", { children: [null, undefined, false, true, "text"] })
    expect(renderToString(vnode)).toBe("<div>text</div>")
  })

  test("nested components with signals", () => {
    const [name] = createSignal("Gorsee")

    function Title(props: { text: () => string }) {
      return h("h1", { children: props.text })
    }

    function Page() {
      return h("main", {
        children: h(Title as any, { text: name }),
      })
    }

    const vnode = h(Page as any, {})
    expect(renderToString(vnode)).toBe("<main><h1>Gorsee</h1></main>")
  })
})
