import { describe, test, expect } from "bun:test"
import { validate } from "../../src/types/user-input.ts"

const stringSchema = {
  parse(raw: unknown): string {
    if (typeof raw !== "string") throw new Error("Expected string")
    return raw
  },
}

const numberSchema = {
  parse(raw: unknown): number {
    if (typeof raw !== "number") throw new Error("Expected number")
    return raw
  },
}

describe("UserInput deep", () => {
  test("creates UserInput from valid string", () => {
    const result = validate(stringSchema, "hello")
    expect(String(result)).toBe("hello")
  })

  test("preserves original value", () => {
    const result = validate(stringSchema, "test value")
    expect(result as any).toBe("test value")
  })

  test("requires schema parse to succeed", () => {
    expect(() => validate(numberSchema, "not a number")).toThrow("Expected number")
  })

  test("with HTML content — not escaped, just wrapped", () => {
    const result = validate(stringSchema, "<script>alert(1)</script>")
    expect(result as any).toBe("<script>alert(1)</script>")
  })

  test("with SQL injection attempt — preserved raw", () => {
    const result = validate(stringSchema, "'; DROP TABLE users; --")
    expect(result as any).toBe("'; DROP TABLE users; --")
  })

  test("with empty string", () => {
    const result = validate(stringSchema, "")
    expect(result as any).toBe("")
  })

  test("with number type", () => {
    const result = validate(numberSchema, 42)
    expect(result as any).toBe(42)
  })

  test("schema can transform value", () => {
    const trimSchema = {
      parse(raw: unknown): string {
        if (typeof raw !== "string") throw new Error("Expected string")
        return raw.trim()
      },
    }
    const result = validate(trimSchema, "  spaced  ")
    expect(result as any).toBe("spaced")
  })

  test("schema can constrain value", () => {
    const nonEmptySchema = {
      parse(raw: unknown): string {
        if (typeof raw !== "string" || raw.length === 0) {
          throw new Error("Non-empty string required")
        }
        return raw
      },
    }
    expect(() => validate(nonEmptySchema, "")).toThrow("Non-empty string required")
  })

  test("with object schema", () => {
    const objSchema = {
      parse(raw: unknown): { name: string } {
        if (!raw || typeof raw !== "object" || !("name" in raw)) {
          throw new Error("Expected object with name")
        }
        return raw as { name: string }
      },
    }
    const result = validate(objSchema, { name: "Alice" })
    expect(result.name).toBe("Alice")
  })
})
