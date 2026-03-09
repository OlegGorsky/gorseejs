import { Database } from "bun:sqlite"
import type { CacheEntry, CacheStore } from "./cache.ts"
import { safeJSONParse } from "../ai/json.ts"

interface SQLiteCacheStoreOptions {
  maxEntryAgeMs?: number
  pruneExpiredOnInit?: boolean
  pruneExpiredOnGet?: boolean
  pruneExpiredOnSet?: boolean
  pruneExpiredOnKeys?: boolean
}

function ensureCacheTable(sqlite: Database): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS gorsee_route_cache (
      cache_key TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      headers TEXT NOT NULL,
      status INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      revalidating INTEGER NOT NULL DEFAULT 0
    )
  `)
}

function pruneExpiredRows(sqlite: Database, maxEntryAgeMs: number, now: number = Date.now()): number {
  const cutoff = now - maxEntryAgeMs
  const result = sqlite.prepare("DELETE FROM gorsee_route_cache WHERE created_at <= ?1").run(cutoff)
  return (result as { changes?: number }).changes ?? 0
}

export function createSQLiteCacheStore(
  path = ":memory:",
  options: SQLiteCacheStoreOptions = {},
): CacheStore & { close(): void; deleteExpired(now?: number): number } {
  const sqlite = new Database(path)
  sqlite.run("PRAGMA journal_mode=WAL;")
  ensureCacheTable(sqlite)
  const {
    maxEntryAgeMs = 24 * 60 * 60 * 1000,
    pruneExpiredOnInit = true,
    pruneExpiredOnGet = true,
    pruneExpiredOnSet = true,
    pruneExpiredOnKeys = true,
  } = options

  if (pruneExpiredOnInit) pruneExpiredRows(sqlite, maxEntryAgeMs)

  return {
    async get(key) {
      if (pruneExpiredOnGet) pruneExpiredRows(sqlite, maxEntryAgeMs)
      const row = sqlite.prepare(`
        SELECT body, headers, status, created_at, revalidating
        FROM gorsee_route_cache
        WHERE cache_key = ?1
      `).get(key) as {
        body: string
        headers: string
        status: number
        created_at: number
        revalidating: number
      } | null
      if (!row) return undefined
      const headers = safeJSONParse<Record<string, string>>(row.headers)
      if (!headers) {
        sqlite.prepare("DELETE FROM gorsee_route_cache WHERE cache_key = ?1").run(key)
        return undefined
      }
      return {
        body: row.body,
        headers,
        status: row.status,
        createdAt: row.created_at,
        revalidating: row.revalidating === 1,
      }
    },
    async set(key, entry) {
      if (pruneExpiredOnSet) pruneExpiredRows(sqlite, maxEntryAgeMs)
      sqlite.prepare(`
        INSERT INTO gorsee_route_cache (cache_key, body, headers, status, created_at, revalidating)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(cache_key) DO UPDATE SET
          body = excluded.body,
          headers = excluded.headers,
          status = excluded.status,
          created_at = excluded.created_at,
          revalidating = excluded.revalidating
      `).run(
        key,
        entry.body,
        JSON.stringify(entry.headers),
        entry.status,
        entry.createdAt,
        entry.revalidating ? 1 : 0,
      )
    },
    async delete(key) {
      sqlite.prepare("DELETE FROM gorsee_route_cache WHERE cache_key = ?1").run(key)
    },
    async clear() {
      sqlite.prepare("DELETE FROM gorsee_route_cache").run()
    },
    async keys() {
      if (pruneExpiredOnKeys) pruneExpiredRows(sqlite, maxEntryAgeMs)
      const rows = sqlite.prepare("SELECT cache_key FROM gorsee_route_cache").all() as Array<{ cache_key: string }>
      return rows.map((row) => row.cache_key)
    },
    deleteExpired(now = Date.now()) {
      return pruneExpiredRows(sqlite, maxEntryAgeMs, now)
    },
    close() {
      sqlite.close()
    },
  }
}
