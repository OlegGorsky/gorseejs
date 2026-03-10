import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { createDB, type DB } from "../../src/db/sqlite.ts"
import { SafeSQL } from "../../src/types/safe-sql.ts"
import { join } from "node:path"
import { rm } from "node:fs/promises"

const TMP_DB = join(import.meta.dir, "__tmp_sqlite_deep.db")
const TMP_DB_WAL = `${TMP_DB}-wal`
const TMP_DB_SHM = `${TMP_DB}-shm`

describe("SQLite deep", () => {
  let db: DB

  beforeEach(() => {
    db = createDB(":memory:")
    db.run(SafeSQL`CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, value REAL)`)
  })

  afterEach(async () => {
    db.close()
    await rm(TMP_DB, { force: true })
    await rm(TMP_DB_WAL, { force: true })
    await rm(TMP_DB_SHM, { force: true })
  })

  test("createDB returns object with get/all/run/close", () => {
    expect(typeof db.get).toBe("function")
    expect(typeof db.all).toBe("function")
    expect(typeof db.run).toBe("function")
    expect(typeof db.close).toBe("function")
  })

  test("createDB with :memory: works", () => {
    const memDb = createDB(":memory:")
    memDb.run(SafeSQL`CREATE TABLE t (id INTEGER)`)
    memDb.close()
  })

  test("createDB with file path works", async () => {
    await rm(TMP_DB, { force: true })
    const fileDb = createDB(TMP_DB)
    fileDb.run(SafeSQL`CREATE TABLE t (id INTEGER)`)
    fileDb.run(SafeSQL`INSERT INTO t VALUES (${1})`)
    const row = fileDb.get<{ id: number }>(SafeSQL`SELECT * FROM t`)
    expect(row?.id).toBe(1)
    fileDb.close()
    await rm(TMP_DB, { force: true })
  })

  test("get returns single row", () => {
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"alpha"}, ${1.5})`)
    const item = db.get<{ name: string; value: number }>(SafeSQL`SELECT * FROM items WHERE name = ${"alpha"}`)
    expect(item).not.toBeNull()
    expect(item!.name).toBe("alpha")
    expect(item!.value).toBe(1.5)
  })

  test("get returns null for no match", () => {
    const result = db.get(SafeSQL`SELECT * FROM items WHERE name = ${"nope"}`)
    expect(result).toBeNull()
  })

  test("all returns array of rows", () => {
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"a"}, ${1})`)
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"b"}, ${2})`)
    const rows = db.all<{ name: string }>(SafeSQL`SELECT * FROM items ORDER BY name`)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.name).toBe("a")
    expect(rows[1]!.name).toBe("b")
  })

  test("all returns empty array for no match", () => {
    const rows = db.all(SafeSQL`SELECT * FROM items WHERE value > ${9999}`)
    expect(rows).toEqual([])
  })

  test("run INSERT returns changes=1", () => {
    const r = db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"x"}, ${0})`)
    expect(r.changes).toBe(1)
  })

  test("run UPDATE with match returns changes count", () => {
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"u"}, ${10})`)
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"u"}, ${20})`)
    const r = db.run(SafeSQL`UPDATE items SET value = ${0} WHERE name = ${"u"}`)
    expect(r.changes).toBe(2)
  })

  test("run UPDATE with no match returns changes=0", () => {
    const r = db.run(SafeSQL`UPDATE items SET value = ${0} WHERE name = ${"none"}`)
    expect(r.changes).toBe(0)
  })

  test("run DELETE returns changes count", () => {
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"d"}, ${1})`)
    const r = db.run(SafeSQL`DELETE FROM items WHERE name = ${"d"}`)
    expect(r.changes).toBe(1)
  })

  test("close does not throw", () => {
    const tmp = createDB(":memory:")
    expect(() => tmp.close()).not.toThrow()
  })

  test("multiple sequential queries work", () => {
    for (let i = 0; i < 10; i++) {
      db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${`item${i}`}, ${i})`)
    }
    const rows = db.all(SafeSQL`SELECT * FROM items`)
    expect(rows).toHaveLength(10)
  })

  test("parameterized queries prevent SQL injection", () => {
    const evil = "'; DROP TABLE items; --"
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${evil}, ${0})`)
    const rows = db.all(SafeSQL`SELECT * FROM items`)
    expect(rows).toHaveLength(1)
    const r = db.get<{ name: string }>(SafeSQL`SELECT * FROM items WHERE name = ${evil}`)
    expect(r!.name).toBe(evil)
  })

  test("large result set (1000 rows)", () => {
    db.run(SafeSQL`CREATE TABLE big (id INTEGER PRIMARY KEY, n INTEGER)`)
    for (let i = 0; i < 1000; i++) {
      db.run(SafeSQL`INSERT INTO big (n) VALUES (${i})`)
    }
    const rows = db.all(SafeSQL`SELECT * FROM big`)
    expect(rows).toHaveLength(1000)
  })

  test("NULL values handled correctly", () => {
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${null}, ${null})`)
    const row = db.get<{ name: string | null }>(SafeSQL`SELECT * FROM items WHERE name IS NULL`)
    expect(row).not.toBeNull()
    expect(row!.name).toBeNull()
  })

  test("get returns first row when multiple match", () => {
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"dup"}, ${1})`)
    db.run(SafeSQL`INSERT INTO items (name, value) VALUES (${"dup"}, ${2})`)
    const row = db.get<{ value: number }>(SafeSQL`SELECT * FROM items WHERE name = ${"dup"}`)
    expect(row).not.toBeNull()
  })
})
