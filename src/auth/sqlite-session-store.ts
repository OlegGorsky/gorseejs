import { Database } from "bun:sqlite"
import type { Session, SessionStore } from "./index.ts"

interface SQLiteSessionStoreOptions {
  pruneExpiredOnInit?: boolean
  pruneExpiredOnGet?: boolean
  pruneExpiredOnSet?: boolean
  pruneExpiredOnEntries?: boolean
}

function ensureSessionTable(sqlite: Database): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS gorsee_sessions (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `)
  sqlite.run("CREATE INDEX IF NOT EXISTS idx_gorsee_sessions_expires_at ON gorsee_sessions (expires_at)")
}

function pruneExpiredRows(sqlite: Database, now: number = Date.now()): number {
  const result = sqlite.prepare("DELETE FROM gorsee_sessions WHERE expires_at <= ?1").run(now)
  return (result as { changes?: number }).changes ?? 0
}

function parseStoredSession(sqlite: Database, id: string, payload: string, expiresAt: number): Session | undefined {
  try {
    return {
      ...(JSON.parse(payload) as Omit<Session, "expiresAt">),
      expiresAt,
    }
  } catch {
    sqlite.prepare("DELETE FROM gorsee_sessions WHERE id = ?1").run(id)
    return undefined
  }
}

export function createSQLiteSessionStore(
  path = ":memory:",
  options: SQLiteSessionStoreOptions = {},
): SessionStore & { close(): void; deleteExpired(now?: number): number } {
  const sqlite = new Database(path)
  sqlite.run("PRAGMA journal_mode=WAL;")
  ensureSessionTable(sqlite)
  const {
    pruneExpiredOnInit = true,
    pruneExpiredOnGet = true,
    pruneExpiredOnSet = true,
    pruneExpiredOnEntries = true,
  } = options

  if (pruneExpiredOnInit) pruneExpiredRows(sqlite)

  return {
    async get(id) {
      if (pruneExpiredOnGet) pruneExpiredRows(sqlite)
      const row = sqlite
        .prepare("SELECT payload, expires_at FROM gorsee_sessions WHERE id = ?1")
        .get(id) as { payload: string; expires_at: number } | null
      if (!row) return undefined
      return parseStoredSession(sqlite, id, row.payload, row.expires_at)
    },
    async set(id, session) {
      if (pruneExpiredOnSet) pruneExpiredRows(sqlite)
      sqlite.prepare(`
        INSERT INTO gorsee_sessions (id, payload, expires_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          expires_at = excluded.expires_at
      `).run(
        id,
        JSON.stringify({
          id: session.id,
          userId: session.userId,
          data: session.data,
        }),
        session.expiresAt,
      )
    },
    async delete(id) {
      sqlite.prepare("DELETE FROM gorsee_sessions WHERE id = ?1").run(id)
    },
    async entries() {
      if (pruneExpiredOnEntries) pruneExpiredRows(sqlite)
      const rows = sqlite.prepare("SELECT id, payload, expires_at FROM gorsee_sessions").all() as Array<{
        id: string
        payload: string
        expires_at: number
      }>
      const sessions: Array<[string, Session]> = []
      for (const row of rows) {
        const session = parseStoredSession(sqlite, row.id, row.payload, row.expires_at)
        if (session) sessions.push([row.id, session])
      }
      return sessions
    },
    deleteExpired(now = Date.now()) {
      return pruneExpiredRows(sqlite, now)
    },
    close() {
      sqlite.close()
    },
  }
}
