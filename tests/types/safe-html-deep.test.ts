import { describe, test, expect } from "bun:test"
import { sanitize, SafeHTML } from "../../src/types/safe-html.ts"
import { unsafeHTML } from "../../src/unsafe/index.ts"

describe("SafeHTML deep", () => {
  test("sanitize creates SafeHTML from string", () => {
    const result = sanitize("hello world")
    expect(typeof result).toBe("string")
  })

  test("sanitize preserves plain text value", () => {
    expect(String(sanitize("hello"))).toBe("hello")
  })

  test("sanitize toString returns escaped string", () => {
    const result = sanitize("<b>bold</b>")
    expect(`${result}`).toBe("&lt;b&gt;bold&lt;/b&gt;")
  })

  test("sanitize with empty string", () => {
    expect(String(sanitize(""))).toBe("")
  })

  test("sanitize escapes ampersands in HTML entities", () => {
    expect(String(sanitize("&amp; &lt;"))).toBe("&amp;amp; &amp;lt;")
  })

  test("sanitize escapes all five dangerous characters", () => {
    const result = sanitize(`&<>"'`)
    expect(String(result)).toBe("&amp;&lt;&gt;&quot;&#x27;")
  })

  test("SafeHTML tagged template preserves static parts", () => {
    const html = SafeHTML`<div class="box">content</div>`
    expect(String(html)).toBe('<div class="box">content</div>')
  })

  test("SafeHTML escapes interpolations only", () => {
    const val = "<script>"
    const html = SafeHTML`safe ${val} safe`
    expect(String(html)).toBe("safe &lt;script&gt; safe")
  })

  test("SafeHTML concatenation via multiple calls", () => {
    const a = SafeHTML`<p>one</p>`
    const b = SafeHTML`<p>two</p>`
    const combined = String(a) + String(b)
    expect(combined).toBe("<p>one</p><p>two</p>")
  })

  test("multiple SafeHTML values are independent", () => {
    const a = SafeHTML`<a>`
    const b = SafeHTML`<b>`
    expect(String(a)).not.toBe(String(b))
    expect(String(a)).toBe("<a>")
    expect(String(b)).toBe("<b>")
  })

  test("SafeHTML with unicode characters", () => {
    const emoji = "\u{1F600}"
    const html = SafeHTML`<span>${emoji}</span>`
    expect(String(html)).toContain("\u{1F600}")
  })

  test("SafeHTML with very long string", () => {
    const long = "x".repeat(100_000)
    const html = SafeHTML`<p>${long}</p>`
    expect(String(html).length).toBe(100_000 + 7)
  })

  test("SafeHTML with multiple interpolations", () => {
    const a = "<a>"
    const b = "<b>"
    const html = SafeHTML`${a} and ${b}`
    expect(String(html)).toBe("&lt;a&gt; and &lt;b&gt;")
  })

  test("unsafeHTML bypasses escaping", () => {
    const raw = "<script>alert(1)</script>"
    const result = unsafeHTML(raw)
    expect(String(result)).toBe(raw)
  })

  test("sanitize does not double-escape already safe content", () => {
    const first = sanitize("<b>")
    const second = sanitize(String(first))
    expect(String(second)).toBe("&amp;lt;b&amp;gt;")
  })

  test("SafeHTML with number interpolation", () => {
    const num = 42
    const html = SafeHTML`<span>${num}</span>`
    expect(String(html)).toBe("<span>42</span>")
  })

  test("SafeHTML with null interpolation", () => {
    const html = SafeHTML`<span>${null}</span>`
    expect(String(html)).toBe("<span>null</span>")
  })

  test("SafeHTML with undefined interpolation", () => {
    const html = SafeHTML`<span>${undefined}</span>`
    expect(String(html)).toBe("<span>undefined</span>")
  })

  test("sanitize with single quotes", () => {
    expect(String(sanitize("it's"))).toBe("it&#x27;s")
  })

  test("sanitize with double quotes", () => {
    expect(String(sanitize('say "hi"'))).toBe("say &quot;hi&quot;")
  })

  test("SafeHTML with no interpolations behaves like literal", () => {
    const html = SafeHTML`just text`
    expect(String(html)).toBe("just text")
  })
})
