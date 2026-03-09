import { describe, expect, test } from "bun:test"
import { createDataMutation, createDataQuery } from "../../src/reactive/data.ts"

async function waitForMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("data query / mutation contract", () => {
  test("createDataQuery binds a stable cache key with explicit invalidation", async () => {
    let runs = 0
    const query = createDataQuery({
      key: "user:1",
      queryFn: async () => {
        runs++
        return { id: 1, name: "Ada" }
      },
    })

    await waitForMicrotasks()
    expect(query.key).toBe("user:1")
    expect(query.data()?.name).toBe("Ada")
    expect(runs).toBe(1)

    query.invalidate()
    query.refetch()
    await waitForMicrotasks()
    expect(runs).toBeGreaterThanOrEqual(2)
  })

  test("createDataMutation invalidates explicit query keys on success", async () => {
    let version = 1
    const query = createDataQuery({
      key: "article:1",
      queryFn: async () => ({ version }),
    })
    await waitForMicrotasks()
    expect(query.data()?.version).toBe(1)

    const mutation = createDataMutation({
      mutationFn: async () => {
        version = 2
        return { ok: true }
      },
      invalidate: ["article:1"],
    })

    await mutation.mutate(undefined)
    query.refetch()
    await waitForMicrotasks()
    expect(query.data()?.version).toBe(2)
  })

  test("optimisticQuery updates bound query state immediately and rolls back on failure", async () => {
    const query = createDataQuery({
      key: "count:1",
      initialData: { count: 1 },
      queryFn: async () => ({ count: 1 }),
    })

    const mutation = createDataMutation<void, number>({
      mutationFn: async () => {
        throw new Error("boom")
      },
    })

    await expect(mutation.optimisticQuery(
      query,
      (current, amount) => ({ count: (current?.count ?? 0) + amount }),
      2,
    )).rejects.toThrow("boom")

    expect(query.data()?.count).toBe(1)
  })
})
