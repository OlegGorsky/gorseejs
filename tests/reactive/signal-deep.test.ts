import { describe, test, expect } from "bun:test"
import { createSignal } from "../../src/reactive/signal.ts"
import { createEffect } from "../../src/reactive/effect.ts"

describe("createSignal deep", () => {
  test("get returns initial value without set", () => {
    const [val] = createSignal(42)
    expect(val()).toBe(42)
  })

  test("set replaces value completely", () => {
    const [val, set] = createSignal("a")
    set("b")
    set("c")
    expect(val()).toBe("c")
  })

  test("update with function uses previous value", () => {
    const [count, setCount] = createSignal(1)
    setCount((c) => c + 1)
    setCount((c) => c * 3)
    expect(count()).toBe(6)
  })

  test("multiple signals are independent", () => {
    const [a, setA] = createSignal(1)
    const [b, setB] = createSignal(100)
    setA(2)
    expect(a()).toBe(2)
    expect(b()).toBe(100)
    setB(200)
    expect(a()).toBe(2)
    expect(b()).toBe(200)
  })

  test("signal with object value", () => {
    const [obj, setObj] = createSignal({ x: 1, y: 2 })
    expect(obj()).toEqual({ x: 1, y: 2 })
    setObj({ x: 10, y: 20 })
    expect(obj()).toEqual({ x: 10, y: 20 })
  })

  test("signal with array value", () => {
    const [arr, setArr] = createSignal([1, 2, 3])
    expect(arr()).toEqual([1, 2, 3])
    setArr((prev) => [...prev, 4])
    expect(arr()).toEqual([1, 2, 3, 4])
  })

  test("signal with null", () => {
    const [val, setVal] = createSignal<string | null>("hello")
    setVal(null)
    expect(val()).toBeNull()
  })

  test("signal with undefined", () => {
    const [val, setVal] = createSignal<number | undefined>(5)
    setVal(undefined)
    expect(val()).toBeUndefined()
  })

  test("signal with falsy value 0", () => {
    const [val] = createSignal(0)
    expect(val()).toBe(0)
  })

  test("signal with falsy value empty string", () => {
    const [val] = createSignal("")
    expect(val()).toBe("")
  })

  test("signal with falsy value false", () => {
    const [val] = createSignal(false)
    expect(val()).toBe(false)
  })

  test("rapid sequential updates", () => {
    const [val, set] = createSignal(0)
    for (let i = 1; i <= 10; i++) set(i)
    expect(val()).toBe(10)
  })

  test("same value set does not trigger effect", () => {
    const [val, set] = createSignal(5)
    let runs = 0
    createEffect(() => { val(); runs++ })
    expect(runs).toBe(1)
    set(5)
    expect(runs).toBe(1)
  })

  test("signal with very large number", () => {
    const [val, set] = createSignal(0)
    set(Number.MAX_SAFE_INTEGER)
    expect(val()).toBe(Number.MAX_SAFE_INTEGER)
  })

  test("signal with very large string", () => {
    const big = "x".repeat(100_000)
    const [val] = createSignal(big)
    expect(val().length).toBe(100_000)
  })

  test("signal set in a loop 1000 iterations", () => {
    const [val, set] = createSignal(0)
    for (let i = 0; i < 1000; i++) set((c) => c + 1)
    expect(val()).toBe(1000)
  })

  test("multiple readers same signal", () => {
    const [val] = createSignal(99)
    expect(val()).toBe(99)
    expect(val()).toBe(99)
    expect(val()).toBe(99)
  })

  test("nested object replacement vs same ref", () => {
    const obj = { a: { b: 1 } }
    const [val, set] = createSignal(obj)
    let runs = 0
    createEffect(() => { val(); runs++ })
    expect(runs).toBe(1)
    // same reference — no trigger
    set(obj)
    expect(runs).toBe(1)
    // new object — triggers
    set({ a: { b: 2 } })
    expect(runs).toBe(2)
  })

  test("signal with Map value", () => {
    const m = new Map([["k", 1]])
    const [val] = createSignal(m)
    expect(val().get("k")).toBe(1)
  })

  test("signal with boolean toggle", () => {
    const [val, set] = createSignal(false)
    set((v) => !v)
    expect(val()).toBe(true)
    set((v) => !v)
    expect(val()).toBe(false)
  })

  test("signal setter returns void", () => {
    const [, set] = createSignal(0)
    const result = set(1)
    expect(result).toBeUndefined()
  })

  test("functional update with complex transformation", () => {
    const [val, set] = createSignal([1, 2, 3])
    set((arr) => arr.map((x) => x * 2).filter((x) => x > 2))
    expect(val()).toEqual([4, 6])
  })

  test("signal initial value is deeply equal but referentially same", () => {
    const init = { nested: { deep: true } }
    const [val] = createSignal(init)
    expect(val()).toBe(init)
  })

  test("two signals same initial value are independent", () => {
    const [a, setA] = createSignal(0)
    const [b] = createSignal(0)
    setA(10)
    expect(a()).toBe(10)
    expect(b()).toBe(0)
  })

  test("signal with Date value", () => {
    const d = new Date("2025-01-01")
    const [val] = createSignal(d)
    expect(val().getFullYear()).toBe(2025)
  })
})
