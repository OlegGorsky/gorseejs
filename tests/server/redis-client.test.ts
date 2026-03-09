import { describe, expect, test } from "bun:test"
import {
  createIORedisLikeClient,
  createNodeRedisLikeClient,
  deleteExpiredRedisKeys,
} from "../../src/server/redis-client.ts"

class FakeSDKRedis {
  store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
    return [...this.store.keys()].filter((key) => key.startsWith(prefix))
  }
}

describe("redis client helpers", () => {
  test("createNodeRedisLikeClient adapts sdk client to framework contract", async () => {
    const sdk = new FakeSDKRedis()
    const client = createNodeRedisLikeClient(sdk)
    await client.set("k", "v")
    expect(await client.get("k")).toBe("v")
  })

  test("createIORedisLikeClient adapts sdk client to framework contract", async () => {
    const sdk = new FakeSDKRedis()
    const client = createIORedisLikeClient(sdk)
    await client.set("k", "v")
    expect(await client.get("k")).toBe("v")
  })

  test("deleteExpiredRedisKeys removes stale entries based on serialized metadata", async () => {
    const sdk = new FakeSDKRedis()
    const client = createNodeRedisLikeClient(sdk)
    await client.set("app:cache:old", JSON.stringify({ createdAt: Date.now() - 10_000 }))
    await client.set("app:cache:new", JSON.stringify({ createdAt: Date.now() }))

    const deleted = await deleteExpiredRedisKeys(
      client,
      "app:cache:*",
      Date.now(),
      (raw) => (JSON.parse(raw) as { createdAt: number }).createdAt,
      1_000,
    )

    expect(deleted).toBe(1)
    expect(await client.get("app:cache:old")).toBeNull()
    expect(await client.get("app:cache:new")).not.toBeNull()
  })
})
