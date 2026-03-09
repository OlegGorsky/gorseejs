import { describe, test, expect } from "bun:test"
import { validateURL, SafeURL } from "../../src/types/safe-url.ts"

describe("SafeURL deep", () => {
  test("creates SafeURL from valid https URL", () => {
    const url = validateURL("https://example.com")
    expect(String(url)).toBe("https://example.com")
  })

  test("rejects javascript: protocol", () => {
    expect(() => validateURL("javascript:alert(1)")).toThrow("Dangerous URL protocol")
  })

  test("rejects JAVASCRIPT: case-insensitive", () => {
    expect(() => validateURL("JAVASCRIPT:alert(1)")).toThrow("Dangerous URL protocol")
  })

  test("rejects data: protocol", () => {
    expect(() => validateURL("data:text/html,hi")).toThrow("Dangerous URL protocol")
  })

  test("rejects vbscript: protocol", () => {
    expect(() => validateURL("vbscript:foo")).toThrow("Dangerous URL protocol")
  })

  test("rejects blob: protocol", () => {
    expect(() => validateURL("blob:http://example.com/uuid")).toThrow("Dangerous URL protocol")
  })

  test("accepts http:// URL", () => {
    const url = validateURL("http://example.com")
    expect(String(url)).toBe("http://example.com")
  })

  test("accepts https:// URL", () => {
    const url = validateURL("https://secure.example.com/page")
    expect(String(url)).toBe("https://secure.example.com/page")
  })

  test("accepts relative paths", () => {
    const url = validateURL("/about/team")
    expect(String(url)).toBe("/about/team")
  })

  test("accepts relative path without leading slash", () => {
    const url = validateURL("images/photo.jpg")
    expect(String(url)).toBe("images/photo.jpg")
  })

  test("URL with query params", () => {
    const url = validateURL("https://example.com/search?q=test&page=1")
    expect(String(url)).toContain("q=test")
  })

  test("URL with hash fragment", () => {
    const url = validateURL("https://example.com/page#section")
    expect(String(url)).toContain("#section")
  })

  test("URL with special characters in path", () => {
    const url = validateURL("https://example.com/path%20with%20spaces")
    expect(String(url)).toContain("%20")
  })

  test("SafeURL tagged template builds and validates", () => {
    const host = "example.com"
    const url = SafeURL`https://${host}/api`
    expect(String(url)).toBe("https://example.com/api")
  })

  test("SafeURL tagged template rejects dangerous protocol", () => {
    expect(() => SafeURL`javascript:${"alert(1)"}`).toThrow("Dangerous URL protocol")
  })

  test("accepts mailto: protocol", () => {
    const url = validateURL("mailto:user@example.com")
    expect(String(url)).toBe("mailto:user@example.com")
  })

  test("rejects javascript: with leading whitespace", () => {
    expect(() => validateURL("  javascript:alert(1)")).toThrow("Dangerous URL protocol")
  })

  test("rejects ftp: protocol as disallowed", () => {
    expect(() => validateURL("ftp://example.com/file")).toThrow("Disallowed URL protocol")
  })
})
