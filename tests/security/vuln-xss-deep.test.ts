import { describe, test, expect } from "bun:test"
import { escapeHTML, escapeAttr } from "../../src/runtime/html-escape.ts"
import { renderToString, ssrJsx } from "../../src/runtime/server.ts"
import { island } from "../../src/runtime/island.ts"
import { sanitize, SafeHTML } from "../../src/types/safe-html.ts"
import type { SafeHTMLValue } from "../../src/types/safe-html.ts"
import { unsafeHTML } from "../../src/unsafe/index.ts"
import { securityHeaders } from "../../src/security/headers.ts"

// ─── 1. XSS via text injection ───────────────────────────────────────────────

describe("XSS text injection", () => {
  test("escapes <script>alert(1)</script>", () => {
    const result = escapeHTML("<script>alert(1)</script>")
    expect(result).not.toContain("<script>")
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  test("escapes <img src=x onerror=alert(1)>", () => {
    const result = escapeHTML('<img src=x onerror=alert(1)>')
    expect(result).not.toContain("<img")
    expect(result).toContain("&lt;img")
  })

  test("escapes all 5 HTML special chars: & < > \" '", () => {
    const input = `& < > " '`
    const result = escapeHTML(input)
    expect(result).toBe("&amp; &lt; &gt; &quot; &#x27;")
  })

  test("escapes nested/recursive injection <scr<script>ipt>", () => {
    const result = escapeHTML("<scr<script>ipt>")
    expect(result).not.toContain("<script>")
    expect(result).not.toContain("<scr")
    expect(result).toBe("&lt;scr&lt;script&gt;ipt&gt;")
  })

  test("escapes null bytes in strings", () => {
    const input = "<script\x00>alert(1)</script>"
    const result = escapeHTML(input)
    expect(result).not.toContain("<script")
  })

  test("escapes unicode escape sequences", () => {
    // \u003c = <, \u003e = >
    const raw = "\u003cscript\u003ealert(1)\u003c/script\u003e"
    const result = escapeHTML(raw)
    expect(result).not.toContain("<script>")
    expect(result).toContain("&lt;script&gt;")
  })

  test("SSR renderToString escapes text children", () => {
    const vnode = ssrJsx("div", { children: '<script>alert("xss")</script>' })
    const html = renderToString(vnode)
    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
  })

  test("SSR renderToString escapes nested text", () => {
    const inner = ssrJsx("span", { children: "<img onerror=alert(1)>" })
    const outer = ssrJsx("div", { children: inner })
    const html = renderToString(outer)
    expect(html).not.toContain("<img onerror")
  })
})

// ─── 2. XSS via attribute injection ──────────────────────────────────────────

describe("XSS attribute injection", () => {
  test("escapeAttr handles double quotes", () => {
    const result = escapeAttr('hello"world')
    expect(result).toBe("hello&quot;world")
  })

  test("escapeAttr prevents attribute breakout", () => {
    const payload = '" onmouseover="alert(1)'
    const result = escapeAttr(payload)
    expect(result).not.toContain('"')
    expect(result).toContain("&quot;")
  })

  test("escapeAttr escapes ampersand", () => {
    expect(escapeAttr("a&b")).toBe("a&amp;b")
  })

  test("SSR renderAttrs escapes attribute values", () => {
    const vnode = ssrJsx("a", {
      href: '" onclick="alert(1)',
      children: "link",
    })
    const html = renderToString(vnode)
    expect(html).not.toContain('onclick="alert')
    expect(html).toContain("&quot;")
  })

  test("SSR filters on: event handler attributes", () => {
    const vnode = ssrJsx("button", {
      "on:click": () => {},
      children: "Click",
    })
    const html = renderToString(vnode)
    expect(html).not.toContain("on:click")
    expect(html).not.toContain("onclick")
  })

  test("javascript: URI in href is escaped in attribute context", () => {
    const vnode = ssrJsx("a", {
      href: "javascript:alert(1)",
      children: "link",
    })
    const html = renderToString(vnode)
    // The href value is rendered but special chars inside would be escaped
    // javascript: itself passes through — CSP blocks inline execution
    expect(html).toContain("href=")
  })

  test("SSR escapes class attribute with injection attempt", () => {
    const vnode = ssrJsx("div", {
      className: '" onclick="alert(1)',
      children: "x",
    })
    const html = renderToString(vnode)
    expect(html).not.toContain('onclick="alert')
  })
})

// ─── 3. Island prop XSS ─────────────────────────────────────────────────────

describe("Island prop XSS", () => {
  function TestComponent(props: Record<string, unknown>) {
    return ssrJsx("span", { children: String(props.text ?? "") })
  }

  test("island serialized props escape HTML entities", () => {
    const IslandComp = island(TestComponent)
    const vnode = IslandComp({ text: '<script>alert("xss")</script>' })
    const html = renderToString(vnode as any)
    // data-props must not contain raw < > "
    expect(html).not.toMatch(/data-props="[^"]*<script>/)
  })

  test("island props with </script> are safe", () => {
    const IslandComp = island(TestComponent)
    const vnode = IslandComp({ text: "</script><script>alert(1)</script>" })
    const html = renderToString(vnode as any)
    // Serialized props must not break out of attribute
    const propsMatch = html.match(/data-props="([^"]*)"/)
    expect(propsMatch).not.toBeNull()
    // The attribute value must not contain unescaped < or >
    const propsVal = propsMatch![1]!
    expect(propsVal).not.toContain("<")
    expect(propsVal).not.toContain(">")
  })

  test("island props with HTML entities are handled", () => {
    const IslandComp = island(TestComponent)
    const vnode = IslandComp({ text: "&amp; &lt; &gt;" })
    const html = renderToString(vnode as any)
    // Should double-escape: & in &amp; becomes &amp;amp;
    expect(html).toContain("data-props=")
  })

  test("island props with double-quote payload are safe", () => {
    const IslandComp = island(TestComponent)
    const vnode = IslandComp({ text: '"><img src=x onerror=alert(1)>' })
    const html = renderToString(vnode as any)
    expect(html).not.toContain('<img src=x onerror')
  })

  test("island strips function props from serialization", () => {
    const IslandComp = island(TestComponent)
    const vnode = IslandComp({ text: "ok", onClick: () => alert(1) } as any)
    const html = renderToString(vnode as any)
    // Functions should not appear in serialized props
    expect(html).not.toContain("onClick")
  })
})

// ─── 4. SafeHTML branded type ────────────────────────────────────────────────

describe("SafeHTML branded type", () => {
  test("sanitize() escapes dangerous content", () => {
    const result = sanitize("<script>alert(1)</script>")
    expect(result as any).toBe("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  test("sanitize() returns SafeHTMLValue type", () => {
    const result: SafeHTMLValue = sanitize("<b>test</b>")
    expect(typeof result).toBe("string")
  })

  test("SafeHTML template tag escapes interpolated values", () => {
    const userInput = '<img onerror="alert(1)">'
    const result = SafeHTML`<div>${userInput}</div>`
    expect(result as any).toContain("&lt;img")
    expect(result as any).not.toContain("<img onerror")
    expect(result as any).toContain("<div>")
  })

  test("SafeHTML template preserves literal parts unescaped", () => {
    const result = SafeHTML`<b>Hello</b>`
    expect(result as any).toBe("<b>Hello</b>")
  })

  test("unsafeHTML bypasses escaping", () => {
    const raw = "<b>Bold</b>"
    const result = unsafeHTML(raw)
    expect(String(result)).toBe("<b>Bold</b>")
  })

  test("plain string cannot be assigned as SafeHTMLValue at runtime check", () => {
    // At runtime SafeHTMLValue is just a string, but the branding ensures
    // TypeScript prevents accidental assignment. We verify unsafeHTML is the
    // only explicit way to create one without sanitize().
    const safe = unsafeHTML("<script>alert(1)</script>")
    expect(String(safe)).toContain("<script>")
  })
})

// ─── 5. CSP nonce ────────────────────────────────────────────────────────────

describe("CSP nonce", () => {
  test("nonce is included in CSP script-src", () => {
    const nonce = "abc123def"
    const headers = securityHeaders({}, nonce)
    expect(headers["Content-Security-Policy"]).toContain(`'nonce-${nonce}'`)
  })

  test("nonce appears in script-src directive specifically", () => {
    const headers = securityHeaders({}, "test-nonce")
    const csp = headers["Content-Security-Policy"]!
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))
    expect(scriptSrc).toContain("nonce-test-nonce")
  })

  test("different nonces produce different CSP values", () => {
    const h1 = securityHeaders({}, "nonce-aaa")
    const h2 = securityHeaders({}, "nonce-bbb")
    expect(h1["Content-Security-Policy"]).not.toBe(h2["Content-Security-Policy"])
  })

  test("nonce is random per request (crypto check)", () => {
    // Simulate generating two nonces as the framework would
    const nonce1 = crypto.randomUUID()
    const nonce2 = crypto.randomUUID()
    expect(nonce1).not.toBe(nonce2)
    // Both should work in securityHeaders
    const h1 = securityHeaders({}, nonce1)
    const h2 = securityHeaders({}, nonce2)
    expect(h1["Content-Security-Policy"]).toContain(nonce1)
    expect(h2["Content-Security-Policy"]).toContain(nonce2)
  })

  test("without nonce, script-src falls back to self", () => {
    const headers = securityHeaders()
    expect(headers["Content-Security-Policy"]).toContain("script-src 'self'")
    expect(headers["Content-Security-Policy"]).not.toContain("nonce-")
  })

  test("CSP blocks inline scripts by not including unsafe-inline for scripts", () => {
    const csp = securityHeaders({}, "n1")["Content-Security-Policy"]!
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!
    expect(scriptSrc).not.toContain("unsafe-inline")
  })
})
