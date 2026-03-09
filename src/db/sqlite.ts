import { Database, type SQLQueryBindings } from "bun:sqlite"
import type { SafeSQLValue } from "../types/safe-sql.ts"

export interface DB {
  get<T>(query: SafeSQLValue): T | null
  all<T>(query: SafeSQLValue): T[]
  run(query: SafeSQLValue): { changes: number }
  close(): void
}

function toBindings(params: readonly unknown[]): SQLQueryBindings[] {
  return params as SQLQueryBindings[]
}

export function createDB(path: string = ":memory:"): DB {
  const sqlite = new Database(path)
  sqlite.run("PRAGMA journal_mode=WAL;")

  return {
    get<T>(query: SafeSQLValue): T | null {
      const stmt = sqlite.prepare(query.text)
      return stmt.get(...toBindings(query.params)) as T | null
    },

    all<T>(query: SafeSQLValue): T[] {
      const stmt = sqlite.prepare(query.text)
      return stmt.all(...toBindings(query.params)) as T[]
    },

    run(query: SafeSQLValue): { changes: number } {
      const stmt = sqlite.prepare(query.text)
      const result = stmt.run(...toBindings(query.params))
      return { changes: (result as { changes?: number }).changes ?? 0 }
    },

    close(): void {
      sqlite.close()
    },
  }
}
