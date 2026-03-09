import { describe, expect, test } from "bun:test"
import { createContext } from "../../src/server/middleware.ts"
import { routeCache } from "../../src/server/cache.ts"

describe("cache security matrix", () => {
  test("auth-aware default varies cache entries by Cookie", async () => {
    const cache = routeCache({ maxAge: 60 })
    let calls = 0

    const first = await cache(
      createContext(new Request("http://localhost/feed", {
        headers: { Cookie: "sid=one" },
      })),
      async () => {
        calls++
        return new Response("user-one")
      },
    )

    const second = await cache(
      createContext(new Request("http://localhost/feed", {
        headers: { Cookie: "sid=two" },
      })),
      async () => {
        calls++
        return new Response("user-two")
      },
    )

    expect(await first.text()).toBe("user-one")
    expect(await second.text()).toBe("user-two")
    expect(calls).toBe(2)
    expect(first.headers.get("Vary")).toContain("Cookie")
    expect(second.headers.get("Vary")).toContain("Authorization")
  })

  test("explicit public cache intent can share entries across auth headers", async () => {
    const cache = routeCache({ maxAge: 60, includeAuthHeaders: false })
    let calls = 0

    const first = await cache(
      createContext(new Request("http://localhost/feed", {
        headers: { Cookie: "sid=one" },
      })),
      async () => {
        calls++
        return new Response("public-feed")
      },
    )

    const second = await cache(
      createContext(new Request("http://localhost/feed", {
        headers: { Cookie: "sid=two" },
      })),
      async () => {
        calls++
        return new Response("should-not-run")
      },
    )

    expect(await first.text()).toBe("public-feed")
    expect(await second.text()).toBe("public-feed")
    expect(second.headers.get("X-Cache")).toBe("HIT")
    expect(calls).toBe(1)
  })

  test("partial navigation headers split cache entries by default", async () => {
    const cache = routeCache({ maxAge: 60 })
    let calls = 0

    const first = await cache(
      createContext(new Request("http://localhost/feed", {
        headers: { Accept: "text/html" },
      })),
      async () => {
        calls++
        return new Response("document-feed")
      },
    )

    const second = await cache(
      createContext(new Request("http://localhost/feed", {
        headers: {
          Accept: "application/json",
          "X-Gorsee-Navigate": "partial",
        },
      })),
      async () => {
        calls++
        return new Response("partial-feed")
      },
    )

    expect(await first.text()).toBe("document-feed")
    expect(await second.text()).toBe("partial-feed")
    expect(calls).toBe(2)
    expect(second.headers.get("Vary")).toContain("X-Gorsee-Navigate")
  })
})
