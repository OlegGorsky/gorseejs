import { afterAll, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { rm } from "node:fs/promises"
import { join } from "node:path"
import type { Session } from "../../src/auth/index.ts"
import { createAuth, createSQLiteSessionStore } from "../../src/auth/index.ts"
import { routeCache } from "../../src/server/cache.ts"
import { createContext } from "../../src/server/middleware.ts"
import { createSQLiteCacheStore } from "../../src/server/sqlite-cache-store.ts"

const SESSION_DB_A = join(process.cwd(), ".tmp-sqlite-session-store-a.db")
const SESSION_DB_B = join(process.cwd(), ".tmp-sqlite-session-store-b.db")
const SESSION_DB_C = join(process.cwd(), ".tmp-sqlite-session-store-c.db")
const SESSION_DB_D = join(process.cwd(), ".tmp-sqlite-session-store-d.db")
const CACHE_DB_A = join(process.cwd(), ".tmp-sqlite-cache-store-a.db")
const CACHE_DB_B = join(process.cwd(), ".tmp-sqlite-cache-store-b.db")
const CACHE_DB_C = join(process.cwd(), ".tmp-sqlite-cache-store-c.db")
const SQLITE_ARTIFACTS = [
  SESSION_DB_A,
  SESSION_DB_B,
  SESSION_DB_C,
  SESSION_DB_D,
  CACHE_DB_A,
  CACHE_DB_B,
  CACHE_DB_C,
]

afterAll(async () => {
  for (const dbPath of SQLITE_ARTIFACTS) {
    await rm(dbPath, { force: true })
    await rm(`${dbPath}-wal`, { force: true })
    await rm(`${dbPath}-shm`, { force: true })
  }
})

describe("sqlite-backed adapters", () => {
  test("createSQLiteSessionStore persists auth sessions across auth instances", async () => {
    const store = createSQLiteSessionStore(SESSION_DB_A)
    const authA = createAuth({ secret: "sqlite-secret", store })
    const loginCtx = createContext(new Request("http://localhost/login"))

    await authA.login(loginCtx, "user-sqlite", { role: "admin" })
    const cookieValue = loginCtx.responseHeaders.get("set-cookie")!
      .split(";")[0]!
      .split("=")
      .slice(1)
      .join("=")

    const authB = createAuth({ secret: "sqlite-secret", store: createSQLiteSessionStore(SESSION_DB_A) })
    const requestCtx = createContext(new Request("http://localhost/admin", {
      headers: { Cookie: `gorsee_session=${cookieValue}` },
    }))

    await authB.middleware(requestCtx, async () => new Response("ok"))
    expect(authB.getSession(requestCtx)?.userId).toBe("user-sqlite")

    store.close()
  })

  test("createSQLiteSessionStore prunes expired sessions automatically", async () => {
    const store = createSQLiteSessionStore(SESSION_DB_B, { pruneExpiredOnInit: false })
    await store.set("expired-session", {
      id: "expired-session",
      userId: "user-expired",
      data: {},
      expiresAt: Date.now() - 1_000,
    })
    await store.set("live-session", {
      id: "live-session",
      userId: "user-live",
      data: {},
      expiresAt: Date.now() + 60_000,
    })

    const entries = await store.entries()
    const ids: string[] = []
    for await (const [id] of entries) ids.push(id)

    expect(ids).toEqual(["live-session"])
    expect(await store.get("expired-session")).toBeUndefined()
    expect(await store.get("live-session")).not.toBeUndefined()

    store.close()
  })

  test("createSQLiteSessionStore exposes explicit deleteExpired()", async () => {
    const store = createSQLiteSessionStore(SESSION_DB_C, {
      pruneExpiredOnInit: false,
      pruneExpiredOnGet: false,
      pruneExpiredOnSet: false,
      pruneExpiredOnEntries: false,
    })
    await store.set("expired-manual", {
      id: "expired-manual",
      userId: "user-expired",
      data: {},
      expiresAt: Date.now() - 1_000,
    })

    expect(store.deleteExpired()).toBe(1)
    expect(await store.get("expired-manual")).toBeUndefined()

    store.close()
  })

  test("createSQLiteSessionStore fails closed on malformed stored payloads", async () => {
    const store = createSQLiteSessionStore(SESSION_DB_D, { pruneExpiredOnInit: false })
    store.close()

    const rawDb = new Database(SESSION_DB_D)
    rawDb.prepare("INSERT OR REPLACE INTO gorsee_sessions (id, payload, expires_at) VALUES (?1, ?2, ?3)").run(
      "broken-session",
      "{not-json",
      Date.now() + 60_000,
    )
    rawDb.close()

    const reader = createSQLiteSessionStore(SESSION_DB_D, { pruneExpiredOnInit: false })
    expect(await reader.get("broken-session")).toBeUndefined()
    const entries: Array<[string, Session]> = []
    for await (const entry of await reader.entries()) {
      entries.push(entry)
    }
    expect(entries.some(([id]) => id === "broken-session")).toBe(false)
    reader.close()
  })

  test("createSQLiteCacheStore persists cached responses across middleware instances", async () => {
    const cacheStore = createSQLiteCacheStore(CACHE_DB_A)
    const cacheA = routeCache({ maxAge: 60, store: cacheStore })
    const cacheB = routeCache({ maxAge: 60, store: createSQLiteCacheStore(CACHE_DB_A) })
    const ctx = createContext(new Request("http://localhost/reports"))

    const first = await cacheA(ctx, async () => new Response("cached-report"))
    const second = await cacheB(ctx, async () => new Response("fresh-report"))

    expect(first.headers.get("X-Cache")).toBe("MISS")
    expect(second.headers.get("X-Cache")).toBe("HIT")
    expect(await second.text()).toBe("cached-report")

    cacheStore.close()
  })

  test("createSQLiteCacheStore prunes expired cache rows automatically", async () => {
    const cacheStore = createSQLiteCacheStore(CACHE_DB_B, {
      maxEntryAgeMs: 100,
      pruneExpiredOnInit: false,
    })
    await cacheStore.set("expired-key", {
      body: "expired",
      headers: {},
      status: 200,
      createdAt: Date.now() - 5_000,
    })
    await cacheStore.set("fresh-key", {
      body: "fresh",
      headers: {},
      status: 200,
      createdAt: Date.now(),
    })

    const keys = await cacheStore.keys()
    const keyList: string[] = []
    for await (const key of keys) keyList.push(key)
    expect(keyList).toEqual(["fresh-key"])
    expect(await cacheStore.get("expired-key")).toBeUndefined()
    expect(await cacheStore.get("fresh-key")).not.toBeUndefined()

    cacheStore.close()
  })

  test("createSQLiteCacheStore exposes explicit deleteExpired()", async () => {
    const cacheStore = createSQLiteCacheStore(CACHE_DB_C, {
      maxEntryAgeMs: 100,
      pruneExpiredOnInit: false,
      pruneExpiredOnGet: false,
      pruneExpiredOnSet: false,
      pruneExpiredOnKeys: false,
    })
    await cacheStore.set("expired-cache", {
      body: "expired",
      headers: {},
      status: 200,
      createdAt: Date.now() - 5_000,
    })

    expect(cacheStore.deleteExpired()).toBe(1)
    expect(await cacheStore.get("expired-cache")).toBeUndefined()

    cacheStore.close()
  })
})
