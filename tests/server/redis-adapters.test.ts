import { describe, expect, test } from "bun:test"
import { createAuth, createRedisSessionStore } from "../../src/auth/index.ts"
import { routeCache } from "../../src/server/cache.ts"
import { createContext } from "../../src/server/middleware.ts"
import { createRedisCacheStore } from "../../src/server/redis-cache-store.ts"
import type { RedisLikeClient } from "../../src/server/redis-client.ts"

class FakeRedisClient implements RedisLikeClient {
  private store = new Map<string, string>()
  private expiresAt = new Map<string, number>()

  async get(key: string): Promise<string | null> {
    this.pruneIfExpired(key)
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key)
    this.expiresAt.delete(key)
    return existed ? 1 : 0
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
    const result: string[] = []
    for (const key of this.store.keys()) {
      this.pruneIfExpired(key)
      if (!this.store.has(key)) continue
      if (key.startsWith(prefix)) result.push(key)
    }
    return result
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key)) return 0
    this.expiresAt.set(key, Date.now() + seconds * 1000)
    return 1
  }

  private pruneIfExpired(key: string): void {
    const expiresAt = this.expiresAt.get(key)
    if (expiresAt === undefined) return
    if (expiresAt > Date.now()) return
    this.store.delete(key)
    this.expiresAt.delete(key)
  }
}

describe("redis-backed adapters", () => {
  test("createRedisSessionStore persists auth sessions across auth instances", async () => {
    const client = new FakeRedisClient()
    const authA = createAuth({
      secret: "redis-secret",
      store: createRedisSessionStore(client, { prefix: "tenant-a:sessions" }),
    })
    const loginCtx = createContext(new Request("http://localhost/login"))

    await authA.login(loginCtx, "redis-user", { role: "editor" })
    const cookieValue = loginCtx.responseHeaders.get("set-cookie")!
      .split(";")[0]!
      .split("=")
      .slice(1)
      .join("=")

    const authB = createAuth({
      secret: "redis-secret",
      store: createRedisSessionStore(client, { prefix: "tenant-a:sessions" }),
    })
    const requestCtx = createContext(new Request("http://localhost/admin", {
      headers: { Cookie: `gorsee_session=${cookieValue}` },
    }))

    await authB.middleware(requestCtx, async () => new Response("ok"))
    expect(authB.getSession(requestCtx)?.userId).toBe("redis-user")
  })

  test("createRedisCacheStore persists cache entries across middleware instances", async () => {
    const client = new FakeRedisClient()
    const cacheA = routeCache({
      maxAge: 60,
      store: createRedisCacheStore(client, { prefix: "tenant-a:cache" }),
    })
    const cacheB = routeCache({
      maxAge: 60,
      store: createRedisCacheStore(client, { prefix: "tenant-a:cache" }),
    })
    const ctx = createContext(new Request("http://localhost/metrics"))

    const first = await cacheA(ctx, async () => new Response("cached-metrics"))
    const second = await cacheB(ctx, async () => new Response("fresh-metrics"))

    expect(first.headers.get("X-Cache")).toBe("MISS")
    expect(second.headers.get("X-Cache")).toBe("HIT")
    expect(await second.text()).toBe("cached-metrics")
  })

  test("createRedisCacheStore prunes expired rows and supports explicit deleteExpired()", async () => {
    const client = new FakeRedisClient()
    const cache = createRedisCacheStore(client, {
      prefix: "tenant-b:cache",
      maxEntryAgeMs: 100,
    })

    await cache.set("expired", {
      body: "expired",
      headers: {},
      status: 200,
      createdAt: Date.now() - 5_000,
    })
    await cache.set("fresh", {
      body: "fresh",
      headers: {},
      status: 200,
      createdAt: Date.now(),
    })

    expect(await cache.get("expired")).toBeUndefined()
    expect(await cache.get("fresh")).not.toBeUndefined()

    await cache.set("expired-2", {
      body: "expired-2",
      headers: {},
      status: 200,
      createdAt: Date.now() - 5_000,
    })
    expect(await cache.deleteExpired()).toBe(1)
  })

  test("createRedisSessionStore fails closed on malformed stored payloads", async () => {
    const client = new FakeRedisClient()
    await client.set("tenant-c:sessions:broken", "{not-json")
    const store = createRedisSessionStore(client, { prefix: "tenant-c:sessions" })

    expect(await store.get("broken")).toBeUndefined()
    expect(await client.get("tenant-c:sessions:broken")).toBeNull()
  })

  test("createRedisSessionStore drops malformed rows during entries iteration", async () => {
    const client = new FakeRedisClient()
    await client.set("tenant-d:sessions:good", JSON.stringify({
      session: {
        id: "good",
        userId: "user-good",
        data: {},
        expiresAt: Date.now() + 60_000,
      },
    }))
    await client.set("tenant-d:sessions:broken", "{not-json")
    const store = createRedisSessionStore(client, { prefix: "tenant-d:sessions" })

    expect(await store.entries()).toEqual([
      [
        "good",
        {
          id: "good",
          userId: "user-good",
          data: {},
          expiresAt: expect.any(Number),
        },
      ],
    ])
    expect(await client.get("tenant-d:sessions:broken")).toBeNull()
  })
})
