import { describe, test, expect } from "bun:test"
import { createMutation } from "../../src/reactive/optimistic.ts"
import { createSignal } from "../../src/reactive/signal.ts"

describe("createMutation deep", () => {
  test("initial state is clean", () => {
    const m = createMutation({ mutationFn: async () => 1 })
    expect(m.data()).toBeUndefined()
    expect(m.error()).toBeUndefined()
    expect(m.isPending()).toBe(false)
  })

  test("isPending is true during mutation", async () => {
    let resolve!: (v: string) => void
    const m = createMutation({
      mutationFn: () => new Promise<string>((r) => { resolve = r }),
    })
    const promise = m.mutate(undefined)
    expect(m.isPending()).toBe(true)
    resolve("done")
    await promise
    expect(m.isPending()).toBe(false)
  })

  test("data signal after success", async () => {
    const m = createMutation({ mutationFn: async (n: number) => n * 2 })
    await m.mutate(5)
    expect(m.data()).toBe(10)
  })

  test("error signal after failure", async () => {
    const m = createMutation({
      mutationFn: async () => { throw new Error("boom") },
    })
    try { await m.mutate(undefined) } catch {}
    expect(m.error()?.message).toBe("boom")
  })

  test("non-Error thrown is wrapped", async () => {
    const m = createMutation({
      mutationFn: async () => { throw "string error" },
    })
    try { await m.mutate(undefined) } catch {}
    expect(m.error()).toBeInstanceOf(Error)
    expect(m.error()?.message).toBe("string error")
  })

  test("onSuccess callback receives data and variables", async () => {
    let cbData: number | undefined
    let cbVars: string | undefined
    const m = createMutation({
      mutationFn: async (s: string) => s.length,
      onSuccess: (data, vars) => { cbData = data; cbVars = vars },
    })
    await m.mutate("hello")
    expect(cbData).toBe(5)
    expect(cbVars).toBe("hello")
  })

  test("onError callback receives error and variables", async () => {
    let cbErr: string | undefined
    let cbVars: number | undefined
    const m = createMutation({
      mutationFn: async (n: number) => { throw new Error(`fail-${n}`) },
      onError: (err, vars) => { cbErr = err.message; cbVars = vars },
    })
    try { await m.mutate(42) } catch {}
    expect(cbErr).toBe("fail-42")
    expect(cbVars).toBe(42)
  })

  test("onSettled callback on success", async () => {
    let settledData: string | undefined
    let settledErr: Error | undefined
    const m = createMutation({
      mutationFn: async () => "ok",
      onSettled: (data, err) => { settledData = data; settledErr = err },
    })
    await m.mutate(undefined)
    expect(settledData).toBe("ok")
    expect(settledErr).toBeUndefined()
  })

  test("onSettled callback on error", async () => {
    let settledData: unknown
    let settledErr: Error | undefined
    const m = createMutation({
      mutationFn: async () => { throw new Error("fail") },
      onSettled: (data, err) => { settledData = data; settledErr = err },
    })
    try { await m.mutate(undefined) } catch {}
    expect(settledData).toBeUndefined()
    expect(settledErr?.message).toBe("fail")
  })

  test("optimistic update applies immediately", async () => {
    let resolve!: () => void
    const [val, setVal] = createSignal(10)
    const m = createMutation({
      mutationFn: () => new Promise<void>((r) => { resolve = r }),
    })
    const promise = m.optimistic(val, setVal, (cur) => cur + 5, undefined)
    // before resolve, value should be updated optimistically
    expect(val()).toBe(15)
    resolve()
    await promise
    expect(val()).toBe(15)
  })

  test("optimistic rollback on error", async () => {
    const [val, setVal] = createSignal("original")
    const m = createMutation<void, string>({
      mutationFn: async () => { throw new Error("fail") },
    })
    try {
      await m.optimistic(
        val, setVal,
        (cur, v) => cur + v,
        "-added",
      )
    } catch {}
    expect(val()).toBe("original")
  })

  test("sequential mutations update data", async () => {
    const m = createMutation({ mutationFn: async (n: number) => n })
    await m.mutate(1)
    expect(m.data()).toBe(1)
    await m.mutate(2)
    expect(m.data()).toBe(2)
    await m.mutate(3)
    expect(m.data()).toBe(3)
  })

  test("reset clears data, error, and isPending", async () => {
    const m = createMutation({
      mutationFn: async () => { throw new Error("x") },
    })
    try { await m.mutate(undefined) } catch {}
    expect(m.error()).toBeDefined()
    m.reset()
    expect(m.data()).toBeUndefined()
    expect(m.error()).toBeUndefined()
    expect(m.isPending()).toBe(false)
  })

  test("mutate returns the result", async () => {
    const m = createMutation({ mutationFn: async (x: number) => x * 3 })
    const result = await m.mutate(7)
    expect(result).toBe(21)
  })

  test("mutate throws on error", async () => {
    const m = createMutation({
      mutationFn: async () => { throw new Error("throws") },
    })
    let caught = false
    try { await m.mutate(undefined) } catch { caught = true }
    expect(caught).toBe(true)
  })

  test("multiple concurrent mutations", async () => {
    const m = createMutation({
      mutationFn: async (n: number) => {
        await new Promise((r) => setTimeout(r, n))
        return n
      },
    })
    const p1 = m.mutate(20)
    const p2 = m.mutate(10)
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe(20)
    expect(r2).toBe(10)
  })
})
