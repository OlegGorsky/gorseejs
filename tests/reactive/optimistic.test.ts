import { describe, it, expect } from "bun:test"
import { createMutation } from "../../src/reactive/optimistic.ts"
import { createSignal } from "../../src/reactive/signal.ts"

describe("createMutation", () => {
  it("mutate calls mutationFn and sets data", async () => {
    const mutation = createMutation({
      mutationFn: async (name: string) => `Hello, ${name}`,
    })
    expect(mutation.isPending()).toBe(false)
    const result = await mutation.mutate("World")
    expect(result).toBe("Hello, World")
    expect(mutation.data()).toBe("Hello, World")
    expect(mutation.isPending()).toBe(false)
  })

  it("sets error on failure", async () => {
    const mutation = createMutation({
      mutationFn: async () => { throw new Error("fail") },
    })
    try {
      await mutation.mutate(undefined)
    } catch {}
    expect(mutation.error()?.message).toBe("fail")
  })

  it("calls onSuccess/onError callbacks", async () => {
    let successData: string | undefined
    let errorMsg: string | undefined

    const m1 = createMutation({
      mutationFn: async (x: string) => x.toUpperCase(),
      onSuccess: (data) => { successData = data },
    })
    await m1.mutate("hello")
    expect(successData).toBe("HELLO")

    const m2 = createMutation({
      mutationFn: async () => { throw new Error("oops") },
      onError: (err) => { errorMsg = err.message },
    })
    try { await m2.mutate(undefined) } catch {}
    expect(errorMsg).toBe("oops")
  })

  it("optimistic updates signal and rolls back on error", async () => {
    const [items, setItems] = createSignal(["a", "b"])

    const mutation = createMutation<void, string>({
      mutationFn: async () => { throw new Error("server error") },
    })

    try {
      await mutation.optimistic(
        items,
        setItems,
        (current, newItem) => [...current, newItem],
        "c",
      )
    } catch {}

    // Should rollback to original
    expect(items()).toEqual(["a", "b"])
  })

  it("optimistic keeps update on success", async () => {
    const [count, setCount] = createSignal(10)

    const mutation = createMutation<number, number>({
      mutationFn: async (n) => n,
    })

    await mutation.optimistic(
      count,
      setCount,
      (current, delta) => current + delta,
      5,
    )

    expect(count()).toBe(15) // optimistic update persists
  })

  it("reset clears all state", async () => {
    const mutation = createMutation({
      mutationFn: async (x: number) => x * 2,
    })
    await mutation.mutate(5)
    expect(mutation.data()).toBe(10)
    mutation.reset()
    expect(mutation.data()).toBeUndefined()
    expect(mutation.error()).toBeUndefined()
    expect(mutation.isPending()).toBe(false)
  })
})
