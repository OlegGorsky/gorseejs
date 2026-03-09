import { describe, test, expect } from "bun:test"
import { createRateLimiter } from "../../src/security/rate-limit.ts"

describe("rateLimiter deep", () => {
  test("first request is allowed", () => {
    const lim = createRateLimiter(10, "1m")
    expect(lim.check("ip1").allowed).toBe(true)
  })

  test("within limit all requests allowed", () => {
    const lim = createRateLimiter(5, "1m")
    for (let i = 0; i < 5; i++) {
      expect(lim.check("ip1").allowed).toBe(true)
    }
  })

  test("at limit the next request is blocked", () => {
    const lim = createRateLimiter(3, "1m")
    lim.check("ip1")
    lim.check("ip1")
    lim.check("ip1")
    expect(lim.check("ip1").allowed).toBe(false)
  })

  test("different IPs have separate counters", () => {
    const lim = createRateLimiter(1, "1m")
    expect(lim.check("ip-a").allowed).toBe(true)
    expect(lim.check("ip-b").allowed).toBe(true)
    expect(lim.check("ip-a").allowed).toBe(false)
    expect(lim.check("ip-b").allowed).toBe(false)
  })

  test("resetAt is in the future", () => {
    const lim = createRateLimiter(5, "1m")
    const result = lim.check("ip1")
    expect(result.resetAt).toBeGreaterThan(Date.now())
  })

  test("remaining decreases with each request", () => {
    const lim = createRateLimiter(5, "1m")
    expect(lim.check("ip1").remaining).toBe(4)
    expect(lim.check("ip1").remaining).toBe(3)
    expect(lim.check("ip1").remaining).toBe(2)
    expect(lim.check("ip1").remaining).toBe(1)
    expect(lim.check("ip1").remaining).toBe(0)
  })

  test("blocked request has remaining 0", () => {
    const lim = createRateLimiter(1, "1m")
    lim.check("ip1")
    const result = lim.check("ip1")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  test("window parsing 1s = 1000ms (limiter created without error)", () => {
    const lim = createRateLimiter(10, "1s")
    expect(lim.check("ip1").allowed).toBe(true)
  })

  test("window parsing 1m (limiter created without error)", () => {
    const lim = createRateLimiter(10, "1m")
    expect(lim.check("ip1").allowed).toBe(true)
  })

  test("window parsing 1h (limiter created without error)", () => {
    const lim = createRateLimiter(10, "1h")
    expect(lim.check("ip1").allowed).toBe(true)
  })

  test("window parsing 30s", () => {
    const lim = createRateLimiter(10, "30s")
    expect(lim.check("ip1").allowed).toBe(true)
  })

  test("invalid window throws", () => {
    expect(() => createRateLimiter(10, "abc")).toThrow("Invalid rate limit window")
    expect(() => createRateLimiter(10, "1x")).toThrow("Invalid rate limit window")
    expect(() => createRateLimiter(10, "")).toThrow("Invalid rate limit window")
  })

  test("limit of 1 blocks second request", () => {
    const lim = createRateLimiter(1, "1m")
    expect(lim.check("ip1").allowed).toBe(true)
    expect(lim.check("ip1").allowed).toBe(false)
  })

  test("limit of 0 blocks all requests", () => {
    const lim = createRateLimiter(0, "1m")
    expect(lim.check("ip1").allowed).toBe(false)
  })

  test("high limit allows many requests", () => {
    const lim = createRateLimiter(10000, "1m")
    for (let i = 0; i < 100; i++) {
      expect(lim.check("ip1").allowed).toBe(true)
    }
  })

  test("reset restores full quota", () => {
    const lim = createRateLimiter(2, "1m")
    lim.check("ip1")
    lim.check("ip1")
    expect(lim.check("ip1").allowed).toBe(false)
    lim.reset("ip1")
    expect(lim.check("ip1").allowed).toBe(true)
    expect(lim.check("ip1").remaining).toBe(0)
  })

  test("concurrent checks from same IP decrement correctly", () => {
    const lim = createRateLimiter(3, "1m")
    const results = [lim.check("ip1"), lim.check("ip1"), lim.check("ip1")]
    expect(results.every((r) => r.allowed)).toBe(true)
    expect(lim.check("ip1").allowed).toBe(false)
  })
})
