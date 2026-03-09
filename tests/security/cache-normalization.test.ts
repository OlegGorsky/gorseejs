import { describe, expect, test } from "bun:test"
import { createContext } from "../../src/server/middleware.ts"
import { clearCache, routeCache } from "../../src/server/cache.ts"

describe("cache vary normalization", () => {
  test("equivalent vary header lists produce the same cache key semantics", async () => {
    await clearCache()
    const cacheA = routeCache({ maxAge: 60, includeAuthHeaders: false, vary: [" Accept-Language ", "x-feature-flag"] })
    const cacheB = routeCache({ maxAge: 60, includeAuthHeaders: false, vary: ["X-Feature-Flag", "accept-language"] })
    let calls = 0

    const first = await cacheA(
      createContext(new Request("http://localhost/feed", {
        headers: { "Accept-Language": "ru", "X-Feature-Flag": "beta" },
      })),
      async () => new Response(`payload-${++calls}`),
    )

    const second = await cacheB(
      createContext(new Request("http://localhost/feed", {
        headers: { "Accept-Language": "ru", "X-Feature-Flag": "beta" },
      })),
      async () => new Response(`payload-${++calls}`),
    )

    expect(await first.text()).toBe("payload-1")
    expect(await second.text()).toBe("payload-1")
    expect(second.headers.get("X-Cache")).toBe("HIT")
    expect(second.headers.get("Vary")).toBe("Accept, Accept-Language, X-Feature-Flag, X-Gorsee-Navigate")
  })

  test("merges existing Vary deterministically without duplicate casing drift", async () => {
    await clearCache()
    const cache = routeCache({ maxAge: 60, includeAuthHeaders: false, vary: ["x-feature-flag", "Accept-Language"] })

    const response = await cache(
      createContext(new Request("http://localhost/feed", {
        headers: { "Accept-Language": "en", "X-Feature-Flag": "beta" },
      })),
      async () => new Response("ok", {
        headers: {
          vary: "accept-language, X-Feature-Flag, accept-language",
        },
      }),
    )

    expect(response.headers.get("Vary")).toBe("Accept, Accept-Language, X-Feature-Flag, X-Gorsee-Navigate")
  })
})
