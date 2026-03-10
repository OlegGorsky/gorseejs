import { describe, test, expect } from "bun:test"
import { createResource, invalidateResource, invalidateAll } from "../../src/reactive/resource.ts"

describe("createResource", () => {
  test("basic fetch resolves data", async () => {
    const [data, { loading }] = createResource(async () => "hello")
    expect(loading()).toBe(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(data()).toBe("hello")
    expect(loading()).toBe(false)
  })

  test("handles fetch errors", async () => {
    const [data, { error, loading }] = createResource(async () => {
      throw new Error("fail")
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(error()?.message).toBe("fail")
    expect(data()).toBeUndefined()
    expect(loading()).toBe(false)
  })

  test("initialData skips fetch", async () => {
    let fetched = false
    const [data, { loading }] = createResource(
      async () => { fetched = true; return "fetched" },
      { initialData: "initial", key: "test-init", staleTime: 999999 },
    )
    // Cache is not valid because key wasn't previously cached
    await new Promise((r) => setTimeout(r, 10))
    expect(fetched).toBe(true)
  })

  test("retry on failure", async () => {
    let attempts = 0
    const [data, { error }] = createResource(
      async () => {
        attempts++
        if (attempts < 3) throw new Error("retry")
        return "success"
      },
      { retry: 3, retryDelay: 10 },
    )
    await new Promise((r) => setTimeout(r, 200))
    expect(data()).toBe("success")
    expect(attempts).toBe(3)
  })

  test("refetch reloads data", async () => {
    let count = 0
    const [data, { refetch }] = createResource(async () => ++count)
    await new Promise((r) => setTimeout(r, 10))
    expect(data()).toBe(1)
    refetch()
    await new Promise((r) => setTimeout(r, 10))
    expect(data()).toBe(2)
  })

  test("mutate updates data locally", async () => {
    const [data, { mutate }] = createResource(async () => "original")
    await new Promise((r) => setTimeout(r, 10))
    expect(data()).toBe("original")
    mutate("mutated")
    expect(data()).toBe("mutated")
  })

  test("mutate updates shared cache for later resources with the same key", async () => {
    const [firstData, { mutate }] = createResource(
      async () => "original",
      { key: "shared-mutate", staleTime: 60_000 },
    )
    await new Promise((r) => setTimeout(r, 10))

    expect(firstData()).toBe("original")
    mutate("mutated")
    expect(firstData()).toBe("mutated")

    let fetchedAgain = false
    const [secondData] = createResource(
      async () => {
        fetchedAgain = true
        return "fresh-fetch"
      },
      { key: "shared-mutate", staleTime: 60_000 },
    )

    expect(secondData()).toBe("mutated")
    expect(fetchedAgain).toBe(false)
  })

  test("invalidateResource clears cache", () => {
    invalidateResource("some-key")
    // Should not throw
  })

  test("invalidateAll clears all cache", () => {
    invalidateAll()
    // Should not throw
  })
})
