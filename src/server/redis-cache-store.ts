import type { CacheEntry, CacheStore } from "./cache.ts"
import {
  buildRedisKey,
  deleteExpiredRedisKeys,
  stripRedisPrefix,
  type RedisLikeClient,
} from "./redis-client.ts"
import { safeJSONParse } from "../ai/json.ts"

interface RedisCacheStoreOptions {
  prefix?: string
  maxEntryAgeMs?: number
}

interface StoredCacheEntry {
  entry: CacheEntry
}

function isExpired(entry: CacheEntry, maxEntryAgeMs: number): boolean {
  return Date.now() - entry.createdAt > maxEntryAgeMs
}

export function createRedisCacheStore(
  client: RedisLikeClient,
  options: RedisCacheStoreOptions = {},
): CacheStore & { deleteExpired(): Promise<number> } {
  const prefix = options.prefix ?? "gorsee:cache"
  const maxEntryAgeMs = options.maxEntryAgeMs ?? 24 * 60 * 60 * 1000

  return {
    async get(key) {
      const raw = await client.get(buildRedisKey(prefix, key))
      if (!raw) return undefined
      const payload = safeJSONParse<StoredCacheEntry>(raw)
      if (!payload?.entry) {
        await client.del(buildRedisKey(prefix, key))
        return undefined
      }
      if (isExpired(payload.entry, maxEntryAgeMs)) {
        await client.del(buildRedisKey(prefix, key))
        return undefined
      }
      return payload.entry
    },
    async set(key, entry) {
      const redisKey = buildRedisKey(prefix, key)
      await client.set(redisKey, JSON.stringify({ entry } satisfies StoredCacheEntry))
      if (client.expire) {
        await client.expire(redisKey, Math.max(1, Math.ceil(maxEntryAgeMs / 1000)))
      }
    },
    async delete(key) {
      await client.del(buildRedisKey(prefix, key))
    },
    async clear() {
      const keys = await client.keys(`${prefix}:*`)
      if (keys.length === 0) return
      for (const key of keys) await client.del(key)
    },
    async keys() {
      const keys = await client.keys(`${prefix}:*`)
      const visibleKeys: string[] = []
      for (const key of keys) {
        const raw = await client.get(key)
        if (!raw) continue
        const payload = safeJSONParse<StoredCacheEntry>(raw)
        if (!payload?.entry) {
          await client.del(key)
          continue
        }
        if (isExpired(payload.entry, maxEntryAgeMs)) {
          await client.del(key)
          continue
        }
        visibleKeys.push(stripRedisPrefix(prefix, key))
      }
      return visibleKeys
    },
    async deleteExpired() {
      return deleteExpiredRedisKeys(
        client,
        `${prefix}:*`,
        Date.now(),
        (raw) => {
          try {
            const payload = JSON.parse(raw) as StoredCacheEntry
            return payload.entry.createdAt
          } catch {
            return undefined
          }
        },
        maxEntryAgeMs,
      )
    },
  }
}
