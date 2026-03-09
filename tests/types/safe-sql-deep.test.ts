import { describe, test, expect } from "bun:test"
import { SafeSQL } from "../../src/types/safe-sql.ts"
import { unsafeSQL } from "../../src/unsafe/index.ts"

describe("SafeSQL deep", () => {
  test("creates query with template literal", () => {
    const q = SafeSQL`SELECT 1`
    expect(q.text).toBe("SELECT 1")
  })

  test("query has text and params properties", () => {
    const q = SafeSQL`SELECT 1`
    expect("text" in q).toBe(true)
    expect("params" in q).toBe(true)
  })

  test("params extracted from interpolation", () => {
    const id = 5
    const q = SafeSQL`SELECT * FROM t WHERE id = ${id}`
    expect(q.params).toEqual([5])
  })

  test("no params when no interpolations", () => {
    const q = SafeSQL`SELECT * FROM users`
    expect(q.params).toEqual([])
    expect(q.text).toBe("SELECT * FROM users")
  })

  test("string param is preserved", () => {
    const name = "Alice"
    const q = SafeSQL`SELECT * FROM users WHERE name = ${name}`
    expect(q.params[0]).toBe("Alice")
    expect(q.text).toContain("?")
  })

  test("number param is preserved", () => {
    const age = 25
    const q = SafeSQL`SELECT * FROM users WHERE age > ${age}`
    expect(q.params[0]).toBe(25)
  })

  test("null param is preserved", () => {
    const q = SafeSQL`UPDATE t SET col = ${null}`
    expect(q.params[0]).toBeNull()
  })

  test("multiple params in correct order", () => {
    const a = "x"
    const b = 2
    const c = true
    const q = SafeSQL`INSERT INTO t (a, b, c) VALUES (${a}, ${b}, ${c})`
    expect(q.params).toEqual(["x", 2, true])
    expect(q.text).toBe("INSERT INTO t (a, b, c) VALUES (?, ?, ?)")
  })

  test("mixed types as params", () => {
    const q = SafeSQL`SELECT ${1}, ${"two"}, ${null}, ${true}`
    expect(q.params).toEqual([1, "two", null, true])
  })

  test("prevents SQL injection via parameterization", () => {
    const evil = "'; DROP TABLE users; --"
    const q = SafeSQL`SELECT * FROM users WHERE name = ${evil}`
    expect(q.text).toBe("SELECT * FROM users WHERE name = ?")
    expect(q.text).not.toContain("DROP")
    expect(q.params[0]).toBe(evil)
  })

  test("empty query string", () => {
    const q = SafeSQL``
    expect(q.text).toBe("")
    expect(q.params).toEqual([])
  })

  test("placeholder is ? for each param", () => {
    const q = SafeSQL`SELECT ${1}, ${2}, ${3}`
    const placeholders = q.text.match(/\?/g)
    expect(placeholders?.length).toBe(3)
  })

  test("unsafeSQL creates raw query without params", () => {
    const raw = unsafeSQL("SELECT * FROM users")
    expect(raw.text).toBe("SELECT * FROM users")
    expect(raw.params).toEqual([])
  })

  test("param at start of query", () => {
    const v = 1
    const q = SafeSQL`${v} = id`
    expect(q.text).toBe("? = id")
    expect(q.params).toEqual([1])
  })

  test("param at end of query", () => {
    const v = 1
    const q = SafeSQL`id = ${v}`
    expect(q.text).toBe("id = ?")
    expect(q.params).toEqual([1])
  })

  test("object param is preserved as-is", () => {
    const obj = { foo: "bar" }
    const q = SafeSQL`INSERT INTO t (data) VALUES (${obj})`
    expect(q.params[0]).toEqual({ foo: "bar" })
  })

  test("undefined param is preserved", () => {
    const q = SafeSQL`SELECT ${undefined}`
    expect(q.params[0]).toBeUndefined()
  })

  test("array param is preserved as-is", () => {
    const arr = [1, 2, 3]
    const q = SafeSQL`SELECT * FROM t WHERE id IN (${arr})`
    expect(q.params[0]).toEqual([1, 2, 3])
  })

  test("consecutive interpolations separated correctly", () => {
    const a = 1
    const b = 2
    const q = SafeSQL`${a}${b}`
    expect(q.text).toBe("??")
    expect(q.params).toEqual([1, 2])
  })
})
