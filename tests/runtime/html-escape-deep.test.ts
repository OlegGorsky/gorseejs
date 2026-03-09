import { describe, test, expect } from "bun:test"
import { escapeHTML, escapeAttr } from "../../src/runtime/html-escape.ts"

describe("escapeHTML", () => {
  test("escapes & to &amp;", () => {
    expect(escapeHTML("a&b")).toBe("a&amp;b")
  })
  test("escapes < to &lt;", () => {
    expect(escapeHTML("a<b")).toBe("a&lt;b")
  })
  test("escapes > to &gt;", () => {
    expect(escapeHTML("a>b")).toBe("a&gt;b")
  })
  test('escapes " to &quot;', () => {
    expect(escapeHTML('a"b')).toBe("a&quot;b")
  })
  test("escapes ' to &#x27;", () => {
    expect(escapeHTML("a'b")).toBe("a&#x27;b")
  })
  test("handles empty string", () => {
    expect(escapeHTML("")).toBe("")
  })
  test("handles string with no special chars", () => {
    expect(escapeHTML("hello world 123")).toBe("hello world 123")
  })
  test("handles string with ALL special chars", () => {
    expect(escapeHTML(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#x27;")
  })
  test("handles long string with mixed content", () => {
    const input = "Hello & welcome <user> to \"our\" site's page"
    const result = escapeHTML(input)
    expect(result).toContain("&amp;")
    expect(result).toContain("&lt;")
    expect(result).toContain("&gt;")
    expect(result).toContain("&quot;")
    expect(result).toContain("&#x27;")
    expect(result).not.toContain("<user>")
  })
  test("preserves Unicode characters", () => {
    expect(escapeHTML("Привет мир")).toBe("Привет мир")
    expect(escapeHTML("日本語")).toBe("日本語")
    expect(escapeHTML("emoji: 🎉")).toBe("emoji: 🎉")
  })
  test("escapes full HTML tags in text", () => {
    expect(escapeHTML("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;")
  })
  test("handles nested quotes", () => {
    expect(escapeHTML(`He said "it's fine"`)).toBe("He said &quot;it&#x27;s fine&quot;")
  })
  test("double escaping: already escaped string gets escaped again", () => {
    const once = escapeHTML("a&b")
    expect(once).toBe("a&amp;b")
    const twice = escapeHTML(once)
    expect(twice).toBe("a&amp;amp;b")
  })
  test("handles multiple ampersands", () => {
    expect(escapeHTML("a&&b&c")).toBe("a&amp;&amp;b&amp;c")
  })
  test("handles only whitespace", () => {
    expect(escapeHTML("   ")).toBe("   ")
  })
})

describe("escapeAttr", () => {
  test('escapes " in attribute values', () => {
    expect(escapeAttr('say "hi"')).toBe("say &quot;hi&quot;")
  })
  test("escapes & in attribute values", () => {
    expect(escapeAttr("a&b")).toBe("a&amp;b")
  })
  test("does NOT escape < > in attr (not in ATTR_ESCAPE_RE)", () => {
    expect(escapeAttr("a<b>c")).toBe("a<b>c")
  })
  test("does NOT escape ' in attr", () => {
    expect(escapeAttr("it's")).toBe("it's")
  })
  test("handles empty string", () => {
    expect(escapeAttr("")).toBe("")
  })
  test("handles clean string", () => {
    expect(escapeAttr("hello")).toBe("hello")
  })
})
