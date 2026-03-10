import { describe, expect, test } from "bun:test"
import { createRedisRateLimiter } from "../../src/security/redis-rate-limit.ts"
import type { RedisLikeClient } from "../../src/server/redis-client.ts"

class FakeRedisRateLimitClient implements RedisLikeClient {
  private readonly store = new Map<string, string>()
  private readonly expiresAt = new Map<string, number>()
  lastExpiredKey: string | null = null
  lastDeletedKey: string | null = null

  async get(key: string): Promise<string | null> {
    this.prune(key)
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async del(key: string): Promise<number> {
    this.lastDeletedKey = key
    const existed = this.store.delete(key)
    this.expiresAt.delete(key)
    return existed ? 1 : 0
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
    return [...this.store.keys()].filter((key) => key.startsWith(prefix))
  }

  async incr(key: string): Promise<number> {
    this.prune(key)
    const current = Number(this.store.get(key) ?? "0") + 1
    this.store.set(key, String(current))
    return current
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key)) return 0
    this.lastExpiredKey = key
    this.expiresAt.set(key, Date.now() + seconds * 1000)
    return 1
  }

  async pttl(key: string): Promise<number> {
    this.prune(key)
    const expiresAt = this.expiresAt.get(key)
    if (expiresAt === undefined) return -1
    return Math.max(0, expiresAt - Date.now())
  }

  private prune(key: string): void {
    const expiresAt = this.expiresAt.get(key)
    if (expiresAt === undefined || expiresAt > Date.now()) return
    this.store.delete(key)
    this.expiresAt.delete(key)
  }
}

describe("redis rate limiter", () => {
  test("allows requests until the configured threshold", async () => {
    const limiter = createRedisRateLimiter(new FakeRedisRateLimitClient(), 2, "1m", { prefix: "tenant-a:rl" })

    expect((await limiter.check("ip-1")).allowed).toBe(true)
    expect((await limiter.check("ip-1")).allowed).toBe(true)
    const blocked = await limiter.check("ip-1")
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  test("reset clears distributed counters", async () => {
    const limiter = createRedisRateLimiter(new FakeRedisRateLimitClient(), 1, "1m")

    expect((await limiter.check("ip-2")).allowed).toBe(true)
    expect((await limiter.check("ip-2")).allowed).toBe(false)
    await limiter.reset("ip-2")
    expect((await limiter.check("ip-2")).allowed).toBe(true)
  })

  test("requires atomic Redis methods", () => {
    expect(() => createRedisRateLimiter({
      get: async () => null,
      set: async () => undefined,
      del: async () => 0,
      keys: async () => [],
    }, 1, "1m")).toThrow("Redis rate limiter requires incr() and expire() support")
  })

  test("uses the configured prefix for Redis keys", async () => {
    const client = new FakeRedisRateLimitClient()
    const limiter = createRedisRateLimiter(client, 2, "1m", { prefix: "tenant-b:rl" })

    await limiter.check("ip-3")
    expect(client.lastExpiredKey).toBe("tenant-b:rl:ip-3")

    await limiter.reset("ip-3")
    expect(client.lastDeletedKey).toBe("tenant-b:rl:ip-3")
  })

  test("falls back to the full window when pttl support is unavailable", async () => {
    const clientWithoutPttl: RedisLikeClient = {
      get: async () => null,
      set: async () => undefined,
      del: async () => 0,
      keys: async () => [],
      incr: async () => 1,
      expire: async () => 1,
    }
    const limiter = createRedisRateLimiter(clientWithoutPttl, 2, "1s")

    const before = Date.now()
    const result = await limiter.check("ip-4")
    const ttlMs = result.resetAt - before

    expect(result.allowed).toBe(true)
    expect(ttlMs).toBeGreaterThanOrEqual(900)
    expect(ttlMs).toBeLessThanOrEqual(1100)
  })
})
