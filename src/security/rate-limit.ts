// In-memory token bucket rate limiter (for Bun runtime)
// For Cloudflare Workers: use Durable Objects adapter (future)

export interface RateLimiter {
  check(key: string): { allowed: boolean; remaining: number; resetAt: number }
  reset(key: string): void
}

interface Bucket {
  tokens: number
  lastRefill: number
}

export function parseRateLimitWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h)$/)
  if (!match) throw new Error(`Invalid rate limit window: "${window}"`)
  const value = Number(match[1])
  switch (match[2]) {
    case "s": return value * 1000
    case "m": return value * 60_000
    case "h": return value * 3_600_000
    default: throw new Error(`Invalid unit: ${match[2]}`)
  }
}

export function createRateLimiter(
  maxRequests: number,
  window: string
): RateLimiter {
  const windowMs = parseRateLimitWindow(window)
  const buckets = new Map<string, Bucket>()

  // Cleanup old entries periodically
  const CLEANUP_INTERVAL = Math.max(windowMs * 2, 60_000)
  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > windowMs * 2) {
        buckets.delete(key)
      }
    }
  }, CLEANUP_INTERVAL)

  // Don't prevent process from exiting
  if (typeof cleanup === "object" && "unref" in cleanup) {
    (cleanup as NodeJS.Timeout).unref()
  }

  return {
    check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
      const now = Date.now()
      let bucket = buckets.get(key)

      if (!bucket) {
        bucket = { tokens: maxRequests, lastRefill: now }
        buckets.set(key, bucket)
      }

      // Refill tokens based on elapsed time
      const elapsed = now - bucket.lastRefill
      if (elapsed >= windowMs) {
        bucket.tokens = maxRequests
        bucket.lastRefill = now
      }

      const resetAt = bucket.lastRefill + windowMs

      if (bucket.tokens > 0) {
        bucket.tokens--
        return { allowed: true, remaining: bucket.tokens, resetAt }
      }

      return { allowed: false, remaining: 0, resetAt }
    },

    reset(key: string): void {
      buckets.delete(key)
    },
  }
}
