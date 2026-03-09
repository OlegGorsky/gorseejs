import { describe, test, expect } from "bun:test"
import { SafeSQL } from "../../src/types/safe-sql.ts"
import { sanitize, SafeHTML } from "../../src/types/safe-html.ts"
import { validateURL, SafeURL } from "../../src/types/safe-url.ts"
import { validate } from "../../src/types/user-input.ts"

describe("SafeSQL", () => {
  test("creates parameterized query", () => {
    const id = 42
    const query = SafeSQL`SELECT * FROM users WHERE id = ${id}`
    expect(query.text).toBe("SELECT * FROM users WHERE id = ?")
    expect(query.params).toEqual([42])
  })

  test("handles multiple params", () => {
    const name = "Alice"
    const age = 30
    const query = SafeSQL`SELECT * FROM users WHERE name = ${name} AND age > ${age}`
    expect(query.text).toBe("SELECT * FROM users WHERE name = ? AND age > ?")
    expect(query.params).toEqual(["Alice", 30])
  })

  test("handles no params", () => {
    const query = SafeSQL`SELECT * FROM users`
    expect(query.text).toBe("SELECT * FROM users")
    expect(query.params).toEqual([])
  })
})

describe("SafeHTML", () => {
  test("sanitize escapes dangerous characters", () => {
    const result = sanitize('<script>alert("xss")</script>')
    expect(String(result)).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;")
  })

  test("tagged template escapes interpolations", () => {
    const userInput = '<img onerror="alert(1)">'
    const html = SafeHTML`<div>${userInput}</div>`
    expect(String(html)).toBe('<div>&lt;img onerror=&quot;alert(1)&quot;&gt;</div>')
  })

  test("preserves safe content in template", () => {
    const html = SafeHTML`<div class="safe">hello</div>`
    expect(String(html)).toBe('<div class="safe">hello</div>')
  })
})

describe("SafeURL", () => {
  test("accepts valid https URL", () => {
    const url = validateURL("https://example.com/path")
    expect(String(url)).toBe("https://example.com/path")
  })

  test("accepts mailto", () => {
    const url = validateURL("mailto:test@example.com")
    expect(String(url)).toBe("mailto:test@example.com")
  })

  test("rejects javascript: protocol", () => {
    expect(() => validateURL("javascript:alert(1)")).toThrow("Dangerous URL protocol")
  })

  test("allows relative URLs", () => {
    const url = validateURL("/some/path")
    expect(String(url)).toBe("/some/path")
  })

  test("rejects data: protocol", () => {
    expect(() => validateURL("data:text/html,<h1>XSS</h1>")).toThrow("Dangerous URL protocol")
  })

  test("tagged template works", () => {
    const domain = "example.com"
    const url = SafeURL`https://${domain}/path`
    expect(String(url)).toBe("https://example.com/path")
  })
})

describe("UserInput", () => {
  test("validate with schema", () => {
    const schema = {
      parse(raw: unknown) {
        if (typeof raw !== "string" || raw.length === 0) {
          throw new Error("Must be non-empty string")
        }
        return raw
      },
    }

    const result = validate(schema, "hello")
    expect(String(result)).toBe("hello")
  })

  test("rejects invalid input", () => {
    const schema = {
      parse(raw: unknown) {
        if (typeof raw !== "number") throw new Error("Must be number")
        return raw
      },
    }

    expect(() => validate(schema, "not a number")).toThrow("Must be number")
  })
})
