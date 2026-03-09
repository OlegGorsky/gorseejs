import { describe, test, expect, beforeEach } from "bun:test"
import { readFileSync } from "node:fs"
import {
  csrfProtection,
  validateCSRFToken,
} from "../../src/security/csrf.ts"
import {
  __registerRPC,
  __resetRPCState,
  handleRPCRequest,
} from "../../src/server/rpc.ts"
import { SafeSQL } from "../../src/types/safe-sql.ts"
import { validateURL, SafeURL } from "../../src/types/safe-url.ts"
import { validate } from "../../src/types/user-input.ts"

// ---------------------------------------------------------------------------
// 1. CSRF bypass attempts
// ---------------------------------------------------------------------------
describe("CSRF bypass attempts", () => {
  const SECRET = "vuln-test-secret"

  test("missing CSRF header -> rejected", async () => {
    const csrf = await csrfProtection(SECRET)
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!
    const req = new Request("http://localhost/submit", {
      method: "POST",
      headers: { cookie: `__gorsee_csrf=${cookieValue}` },
    })
    expect(await validateCSRFToken(req, SECRET)).toBe(false)
  })

  test("missing CSRF cookie -> rejected", async () => {
    const csrf = await csrfProtection(SECRET)
    const req = new Request("http://localhost/submit", {
      method: "POST",
      headers: { "x-gorsee-csrf": csrf.token },
    })
    expect(await validateCSRFToken(req, SECRET)).toBe(false)
  })

  test("mismatched token and cookie -> rejected", async () => {
    const csrfA = await csrfProtection(SECRET)
    const csrfB = await csrfProtection(SECRET)
    const cookieValue = csrfA.cookie.split("=")[1]!.split(";")[0]!
    const req = new Request("http://localhost/submit", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${cookieValue}`,
        "x-gorsee-csrf": csrfB.token, // token from different generation
      },
    })
    expect(await validateCSRFToken(req, SECRET)).toBe(false)
  })

  test("tampered signature -> rejected", async () => {
    const csrf = await csrfProtection(SECRET)
    // Replace last char of signature with a different one
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!
    const [token, sig] = cookieValue.split(".")
    const lastChar = sig!.slice(-1)
    const tampered = token + "." + sig!.slice(0, -1) + (lastChar === "a" ? "b" : "a")
    const req = new Request("http://localhost/submit", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${tampered}`,
        "x-gorsee-csrf": token!,
      },
    })
    expect(await validateCSRFToken(req, SECRET)).toBe(false)
  })

  test("GET is exempt from CSRF", async () => {
    const req = new Request("http://localhost/data", { method: "GET" })
    expect(await validateCSRFToken(req, SECRET)).toBe(true)
  })

  test("HEAD is exempt from CSRF", async () => {
    const req = new Request("http://localhost/data", { method: "HEAD" })
    expect(await validateCSRFToken(req, SECRET)).toBe(true)
  })

  test("OPTIONS is exempt from CSRF", async () => {
    const req = new Request("http://localhost/data", { method: "OPTIONS" })
    expect(await validateCSRFToken(req, SECRET)).toBe(true)
  })

  test("timingSafeEqual is used in csrf.ts source", () => {
    const source = readFileSync(
      new URL("../../src/security/csrf.ts", import.meta.url),
      "utf-8",
    )
    expect(source).toContain("timingSafeEqual")
    // Also verify it is imported from node:crypto
    expect(source).toContain('import { timingSafeEqual } from "node:crypto"')
  })

  test("cookie without dot separator -> rejected", async () => {
    const req = new Request("http://localhost/submit", {
      method: "POST",
      headers: {
        cookie: "__gorsee_csrf=nodothere",
        "x-gorsee-csrf": "nodothere",
      },
    })
    expect(await validateCSRFToken(req, SECRET)).toBe(false)
  })

  test("wrong secret -> rejected even with valid pair", async () => {
    const csrf = await csrfProtection("secret-one")
    const cookieValue = csrf.cookie.split("=")[1]!.split(";")[0]!
    const req = new Request("http://localhost/submit", {
      method: "POST",
      headers: {
        cookie: `__gorsee_csrf=${cookieValue}`,
        "x-gorsee-csrf": csrf.token,
      },
    })
    // Validate with a different secret
    expect(await validateCSRFToken(req, "secret-two")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. RPC injection
// ---------------------------------------------------------------------------
describe("RPC injection", () => {
  beforeEach(() => __resetRPCState())

  test("invalid JSON body -> 400", async () => {
    __registerRPC("rpchandler001", async () => "ok")
    const req = new Request("http://localhost/api/_rpc/rpchandler001", {
      method: "POST",
      body: "{broken json!!!",
      headers: { "Content-Type": "application/json", "Content-Length": "15" },
    })
    const res = await handleRPCRequest(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(400)
    const body = await res!.json() as { error: string }
    expect(body.error).toContain("Invalid JSON")
  })

  test("non-array body -> 400", async () => {
    __registerRPC("rpchandler002", async () => "ok")
    const req = new Request("http://localhost/api/_rpc/rpchandler002", {
      method: "POST",
      body: JSON.stringify({ obj: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(400)
    const body = await res!.json() as { error: string }
    expect(body.error).toContain("array")
  })

  test("body exceeding 1MB via Content-Length -> 413", async () => {
    __registerRPC("rpchandler003", async () => "ok")
    const req = new Request("http://localhost/api/_rpc/rpchandler003", {
      method: "POST",
      body: JSON.stringify([]),
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(2 * 1024 * 1024), // 2MB header
      },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(413)
  })

  test("invalid RPC ID format (special chars) -> null (no match)", async () => {
    const req = new Request("http://localhost/api/_rpc/../../etc/passwd", {
      method: "POST",
      body: JSON.stringify([]),
    })
    const res = await handleRPCRequest(req)
    // URL parsing normalizes path, regex won't match non-alphanumeric
    expect(res).toBeNull()
  })

  test("RPC ID with path traversal dots -> null (regex rejects)", async () => {
    const req = new Request("http://localhost/api/_rpc/abc..def", {
      method: "POST",
      body: JSON.stringify([]),
    })
    const res = await handleRPCRequest(req)
    // Dots are not in [a-zA-Z0-9], so regex does not match
    expect(res).toBeNull()
  })

  test("RPC ID with slashes -> null", async () => {
    const req = new Request("http://localhost/api/_rpc/abc/def", {
      method: "POST",
      body: JSON.stringify([]),
    })
    const res = await handleRPCRequest(req)
    expect(res).toBeNull()
  })

  test("unknown handler -> 404", async () => {
    const req = new Request("http://localhost/api/_rpc/doesnotexist", {
      method: "POST",
      body: JSON.stringify([]),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handleRPCRequest(req)
    expect(res!.status).toBe(404)
  })

  test("error messages hidden in production mode", async () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      __registerRPC("rpcprodtest1", async () => {
        throw new Error("sensitive db info leaked")
      })
      const req = new Request("http://localhost/api/_rpc/rpcprodtest1", {
        method: "POST",
        body: JSON.stringify([]),
        headers: { "Content-Type": "application/json" },
      })
      const res = await handleRPCRequest(req)
      expect(res!.status).toBe(500)
      const body = await res!.json() as { error: string }
      expect(body.error).toBe("Internal server error")
      expect(body.error).not.toContain("sensitive")
    } finally {
      process.env.NODE_ENV = origEnv
    }
  })

  test("RPC regex only matches alphanumeric IDs", () => {
    const pattern = /^\/api\/_rpc\/([a-zA-Z0-9]+)$/
    expect(pattern.test("/api/_rpc/abc123")).toBe(true)
    expect(pattern.test("/api/_rpc/abc-123")).toBe(false)
    expect(pattern.test("/api/_rpc/abc_123")).toBe(false)
    expect(pattern.test("/api/_rpc/../etc")).toBe(false)
    expect(pattern.test("/api/_rpc/abc%00def")).toBe(false)
    expect(pattern.test("/api/_rpc/")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. SQL injection via SafeSQL
// ---------------------------------------------------------------------------
describe("SQL injection via SafeSQL", () => {
  test("SafeSQL uses parameterized queries — values go to params", () => {
    const userInput = "'; DROP TABLE users; --"
    const query = SafeSQL`SELECT * FROM users WHERE name = ${userInput}`
    expect(query.text).toBe("SELECT * FROM users WHERE name = ?")
    expect(query.params).toEqual(["'; DROP TABLE users; --"])
    // The malicious string is NEVER in the text, only in params
    expect(query.text).not.toContain("DROP")
  })

  test("multiple interpolations produce multiple params", () => {
    const q = SafeSQL`INSERT INTO t (a, b, c) VALUES (${1}, ${2}, ${3})`
    expect(q.text).toBe("INSERT INTO t (a, b, c) VALUES (?, ?, ?)")
    expect(q.params).toEqual([1, 2, 3])
  })

  test("no interpolation -> empty params", () => {
    const q = SafeSQL`SELECT 1`
    expect(q.text).toBe("SELECT 1")
    expect(q.params).toEqual([])
  })

  test("cannot concatenate raw strings into query text", () => {
    const malicious = "1; DROP TABLE users"
    const q = SafeSQL`SELECT * FROM t WHERE id = ${malicious}`
    // Raw string goes only into params, never into text
    expect(q.text).not.toContain(malicious)
    expect(q.params[0]).toBe(malicious)
  })
})

// ---------------------------------------------------------------------------
// 4. URL injection via SafeURL
// ---------------------------------------------------------------------------
describe("URL injection via SafeURL", () => {
  test("rejects javascript: protocol", () => {
    expect(() => validateURL("javascript:alert(1)")).toThrow("Dangerous URL protocol")
  })

  test("rejects javascript: case-insensitive", () => {
    expect(() => validateURL("JaVaScRiPt:alert(1)")).toThrow("Dangerous URL protocol")
  })

  test("rejects data: protocol", () => {
    expect(() => validateURL("data:text/html,<script>alert(1)</script>")).toThrow(
      "Dangerous URL protocol",
    )
  })

  test("rejects vbscript: protocol", () => {
    expect(() => validateURL("vbscript:MsgBox")).toThrow("Dangerous URL protocol")
  })

  test("rejects blob: protocol", () => {
    expect(() => validateURL("blob:http://evil.com/payload")).toThrow(
      "Dangerous URL protocol",
    )
  })

  test("allows http:// URLs", () => {
    expect(() => validateURL("http://example.com")).not.toThrow()
  })

  test("allows https:// URLs", () => {
    expect(() => validateURL("https://example.com/path?q=1")).not.toThrow()
  })

  test("allows relative URLs", () => {
    expect(() => validateURL("/about")).not.toThrow()
    expect(() => validateURL("./page")).not.toThrow()
  })

  test("SafeURL template tag rejects dangerous protocols", () => {
    const proto = "javascript"
    expect(() => SafeURL`${proto}:alert(1)`).toThrow("Dangerous URL protocol")
  })

  test("rejects ftp: protocol (not in allow list)", () => {
    expect(() => validateURL("ftp://files.example.com")).toThrow("Disallowed URL protocol")
  })
})

// ---------------------------------------------------------------------------
// 5. UserInput validation
// ---------------------------------------------------------------------------
describe("UserInput validation", () => {
  const stringSchema = {
    parse(raw: unknown): string {
      if (typeof raw !== "string") throw new Error("Expected string")
      return raw
    },
  }

  const numberSchema = {
    parse(raw: unknown): number {
      const n = Number(raw)
      if (Number.isNaN(n)) throw new Error("Expected number")
      return n
    },
  }

  test("schema validation is required — throws on invalid", () => {
    expect(() => validate(numberSchema, "not-a-number")).toThrow("Expected number")
  })

  test("malicious input preserved, not auto-escaped", () => {
    const xss = '<script>alert("xss")</script>'
    const result = validate(stringSchema, xss)
    // Value is preserved as-is, wrapped in branded type
    expect(result as any).toBe(xss)
  })

  test("valid input passes through", () => {
    const result = validate(numberSchema, "42")
    expect(result as any).toBe(42)
  })

  test("schema rejects wrong type", () => {
    expect(() => validate(stringSchema, 123)).toThrow("Expected string")
  })
})

// ---------------------------------------------------------------------------
// 6. Path traversal
// ---------------------------------------------------------------------------
describe("Path traversal", () => {
  test("/../ in URL path is normalized by URL constructor", () => {
    const url = new URL("http://localhost/public/../../../etc/passwd")
    // URL constructor normalizes path traversal
    expect(url.pathname).not.toContain("..")
    expect(url.pathname).toBe("/etc/passwd")
    // Even after normalization, a proper server should restrict to served dir
  })

  test("RPC endpoint rejects path traversal in ID", async () => {
    const req = new Request("http://localhost/api/_rpc/..%2F..%2Fetc%2Fpasswd")
    const res = await handleRPCRequest(req)
    // Regex [a-zA-Z0-9]+ won't match URL-encoded path traversal
    expect(res).toBeNull()
  })

  test("encoded dots in RPC path are rejected", async () => {
    const req = new Request("http://localhost/api/_rpc/%2e%2e%2f%2e%2e%2f")
    const res = await handleRPCRequest(req)
    expect(res).toBeNull()
  })

  test("null bytes in URL path don't bypass RPC regex", async () => {
    const req = new Request("http://localhost/api/_rpc/abc%00def")
    const res = await handleRPCRequest(req)
    // %00 is not in [a-zA-Z0-9]
    expect(res).toBeNull()
  })
})
