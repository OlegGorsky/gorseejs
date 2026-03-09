import { Database } from "bun:sqlite"

const db = new Database("./realworld.db")
db.run("PRAGMA journal_mode=WAL;")

export function query<T>(sql: string, params: (string | number | boolean | null)[] = []): T[] {
  const stmt = db.prepare(sql)
  return stmt.all(...params) as T[]
}

export function queryOne<T>(sql: string, params: (string | number | boolean | null)[] = []): T | null {
  const stmt = db.prepare(sql)
  return (stmt.get(...params) as T) ?? null
}

export function run(sql: string, params: (string | number | boolean | null)[] = []): void {
  const stmt = db.prepare(sql)
  stmt.run(...params)
}

export function lastInsertId(): number {
  const row = queryOne<{ id: number }>("SELECT last_insert_rowid() as id")
  return row?.id ?? 0
}
