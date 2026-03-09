import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { createDB, type DB } from "../../src/db/sqlite.ts"
import { SafeSQL } from "../../src/types/safe-sql.ts"

describe("DB (SQLite)", () => {
  let db: DB

  beforeEach(() => {
    db = createDB(":memory:")
    db.run(SafeSQL`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`)
    db.run(SafeSQL`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`)
    db.run(SafeSQL`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`)
  })

  afterEach(() => {
    db.close()
  })

  test("get returns single row", () => {
    const user = db.get<{ id: number; name: string; age: number }>(
      SafeSQL`SELECT * FROM users WHERE name = ${"Alice"}`
    )
    expect(user).not.toBeNull()
    expect(user!.name).toBe("Alice")
    expect(user!.age).toBe(30)
  })

  test("get returns null for no match", () => {
    const user = db.get(SafeSQL`SELECT * FROM users WHERE name = ${"Nobody"}`)
    expect(user).toBeNull()
  })

  test("all returns array", () => {
    const users = db.all<{ name: string }>(SafeSQL`SELECT name FROM users ORDER BY name`)
    expect(users).toHaveLength(2)
    expect(users[0]!.name).toBe("Alice")
    expect(users[1]!.name).toBe("Bob")
  })

  test("run returns changes count", () => {
    const result = db.run(SafeSQL`UPDATE users SET age = ${99} WHERE name = ${"Alice"}`)
    expect(result.changes).toBe(1)
  })

  test("parameterized queries prevent injection", () => {
    const malicious = "'; DROP TABLE users; --"
    const user = db.get(SafeSQL`SELECT * FROM users WHERE name = ${malicious}`)
    expect(user).toBeNull()

    // Table still exists
    const count = db.all(SafeSQL`SELECT * FROM users`)
    expect(count).toHaveLength(2)
  })
})
