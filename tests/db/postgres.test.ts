import { describe, expect, test } from "bun:test"
import { createPostgresDB, toPostgresSQL, type PostgresConnectionLike, type PostgresPoolLike } from "../../src/db/postgres.ts"
import { SafeSQL } from "../../src/types/safe-sql.ts"

class FakePostgresConnection implements PostgresConnectionLike {
  public readonly queries: Array<{ text: string; params: readonly unknown[] }> = []
  public released = false

  constructor(
    private readonly handler: (text: string, params: readonly unknown[]) => { rows: unknown[]; rowCount?: number | null },
  ) {}

  async query<Row>(text: string, params: readonly unknown[] = []): Promise<{ rows: Row[]; rowCount?: number | null }> {
    this.queries.push({ text, params })
    return this.handler(text, params) as { rows: Row[]; rowCount?: number | null }
  }

  async release(): Promise<void> {
    this.released = true
  }
}

class FakePostgresPool implements PostgresPoolLike {
  public readonly rootQueries: Array<{ text: string; params: readonly unknown[] }> = []

  constructor(private readonly connection: FakePostgresConnection) {}

  async query<Row>(text: string, params: readonly unknown[] = []): Promise<{ rows: Row[]; rowCount?: number | null }> {
    this.rootQueries.push({ text, params })
    return this.connection.query<Row>(text, params)
  }

  async connect(): Promise<PostgresConnectionLike> {
    return this.connection
  }
}

describe("postgres db surface", () => {
  test("toPostgresSQL rewrites safe placeholders to numbered parameters", () => {
    expect(toPostgresSQL(SafeSQL`select * from users where id = ${"u1"} and role = ${"admin"}`)).toEqual({
      text: "select * from users where id = $1 and role = $2",
      params: ["u1", "admin"],
    })
  })

  test("createPostgresDB get/all/run use safe SQL conversion", async () => {
    const connection = new FakePostgresConnection((text) => {
      if (text.startsWith("select one")) return { rows: [{ id: "u1" }] }
      if (text.startsWith("select many")) return { rows: [{ id: "u1" }, { id: "u2" }] }
      return { rows: [], rowCount: 2 }
    })
    const db = createPostgresDB(new FakePostgresPool(connection))

    expect(await db.get<{ id: string }>(SafeSQL`select one where id = ${"u1"}`)).toEqual({ id: "u1" })
    expect(await db.all<{ id: string }>(SafeSQL`select many where role = ${"admin"}`)).toEqual([{ id: "u1" }, { id: "u2" }])
    expect(await db.run(SafeSQL`update users set role = ${"admin"} where id = ${"u1"}`)).toEqual({ changes: 2 })

    expect(connection.queries[0]).toEqual({
      text: "select one where id = $1",
      params: ["u1"],
    })
    expect(connection.queries[1]).toEqual({
      text: "select many where role = $1",
      params: ["admin"],
    })
    expect(connection.queries[2]).toEqual({
      text: "update users set role = $1 where id = $2",
      params: ["admin", "u1"],
    })
  })

  test("transaction uses dedicated connection and releases it after commit", async () => {
    const connection = new FakePostgresConnection((text) => {
      if (text === "select value") return { rows: [{ value: 42 }] }
      return { rows: [], rowCount: 1 }
    })
    const db = createPostgresDB(new FakePostgresPool(connection))

    const value = await db.transaction(async (tx) => {
      await tx.run(SafeSQL`update jobs set status = ${"running"} where id = ${"job-1"}`)
      return (await tx.get<{ value: number }>(SafeSQL`select value`))?.value
    })

    expect(value).toBe(42)
    expect(connection.queries.map((entry) => entry.text)).toEqual([
      "BEGIN",
      "update jobs set status = $1 where id = $2",
      "select value",
      "COMMIT",
    ])
    expect(connection.released).toBe(true)
  })

  test("transaction rolls back on failure", async () => {
    const connection = new FakePostgresConnection(() => ({ rows: [], rowCount: 1 }))
    const db = createPostgresDB(new FakePostgresPool(connection))

    await expect(db.transaction(async (tx) => {
      await tx.run(SafeSQL`update jobs set status = ${"running"} where id = ${"job-2"}`)
      throw new Error("boom")
    })).rejects.toThrow("boom")

    expect(connection.queries.map((entry) => entry.text)).toEqual([
      "BEGIN",
      "update jobs set status = $1 where id = $2",
      "ROLLBACK",
    ])
  })
})
