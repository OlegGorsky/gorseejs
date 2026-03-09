import { buildRedisKey, type RedisLikeClient } from "../server/redis-client.ts"
import { parseRateLimitWindow } from "./rate-limit.ts"

export interface AsyncRateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export interface AsyncRateLimiter {
  check(key: string): Promise<AsyncRateLimitResult>
  reset(key: string): Promise<void>
}

export interface RedisRateLimiterOptions {
  prefix?: string
}

export function createRedisRateLimiter(
  client: RedisLikeClient,
  maxRequests: number,
  window: string,
  options: RedisRateLimiterOptions = {},
): AsyncRateLimiter {
  if (!client.incr || !client.expire) {
    throw new Error("Redis rate limiter requires incr() and expire() support on the Redis client.")
  }

  const prefix = options.prefix ?? "gorsee:rate-limit"
  const windowMs = parseRateLimitWindow(window)

  return {
    async check(key) {
      const redisKey = buildRedisKey(prefix, key)
      const now = Date.now()
      const count = await client.incr!(redisKey)
      if (count === 1) {
        await client.expire!(redisKey, Math.max(1, Math.ceil(windowMs / 1000)))
      }

      const ttlMs = client.pttl
        ? Math.max(0, await client.pttl(redisKey))
        : windowMs

      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAt: now + ttlMs,
      }
    },

    async reset(key) {
      await client.del(buildRedisKey(prefix, key))
    },
  }
}
