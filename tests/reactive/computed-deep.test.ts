import { describe, test, expect } from "bun:test"
import { createSignal } from "../../src/reactive/signal.ts"
import { createComputed } from "../../src/reactive/computed.ts"
import { createEffect } from "../../src/reactive/effect.ts"
import { createStore } from "../../src/reactive/store.ts"

describe("createComputed deep", () => {
  test("basic computed from signal", () => {
    const [x] = createSignal(5)
    const doubled = createComputed(() => x() * 2)
    expect(doubled()).toBe(10)
  })

  test("computed from multiple signals", () => {
    const [a] = createSignal(2)
    const [b] = createSignal(3)
    const sum = createComputed(() => a() + b())
    expect(sum()).toBe(5)
  })

  test("computed chain A -> B -> C", () => {
    const [a, setA] = createSignal(1)
    const b = createComputed(() => a() * 2)
    const c = createComputed(() => b() + 10)
    expect(c()).toBe(12)
    setA(5)
    expect(c()).toBe(20)
  })

  test("computed with conditional logic", () => {
    const [flag, setFlag] = createSignal(true)
    const [x] = createSignal(10)
    const [y] = createSignal(20)
    const result = createComputed(() => (flag() ? x() : y()))
    expect(result()).toBe(10)
    setFlag(false)
    expect(result()).toBe(20)
  })

  test("computed re-evaluates on dependency change", () => {
    const [n, setN] = createSignal(3)
    let evalCount = 0
    const c = createComputed(() => { evalCount++; return n() * n() })
    c() // first eval
    setN(4)
    c() // re-eval
    expect(c()).toBe(16)
    expect(evalCount).toBeGreaterThanOrEqual(2)
  })

  test("computed does NOT re-evaluate when deps unchanged", () => {
    const [n] = createSignal(7)
    let evalCount = 0
    const c = createComputed(() => { evalCount++; return n() })
    c()
    c()
    c()
    expect(evalCount).toBe(1)
  })

  test("computed with array map", () => {
    const [items, setItems] = createSignal([1, 2, 3])
    const doubled = createComputed(() => items().map((x) => x * 2))
    expect(doubled()).toEqual([2, 4, 6])
    setItems([10, 20])
    expect(doubled()).toEqual([20, 40])
  })

  test("computed with array filter", () => {
    const [nums, setNums] = createSignal([1, 2, 3, 4, 5])
    const evens = createComputed(() => nums().filter((n) => n % 2 === 0))
    expect(evens()).toEqual([2, 4])
    setNums([10, 11, 12])
    expect(evens()).toEqual([10, 12])
  })

  test("computed with string operations", () => {
    const [first] = createSignal("Hello")
    const [last] = createSignal("World")
    const full = createComputed(() => `${first()} ${last()}`)
    expect(full()).toBe("Hello World")
  })

  test("diamond dependency A -> B, A -> C, B+C -> D", () => {
    const [a, setA] = createSignal(2)
    const b = createComputed(() => a() + 1)
    const c = createComputed(() => a() * 2)
    const d = createComputed(() => b() + c())
    expect(d()).toBe(7) // 3 + 4
    setA(10)
    expect(d()).toBe(31) // 11 + 20
  })

  test("computed returning object", () => {
    const [x, setX] = createSignal(1)
    const obj = createComputed(() => ({ value: x(), label: `#${x()}` }))
    expect(obj()).toEqual({ value: 1, label: "#1" })
    setX(42)
    expect(obj()).toEqual({ value: 42, label: "#42" })
  })

  test("computed returning null", () => {
    const [x] = createSignal<number | null>(null)
    const c = createComputed(() => x())
    expect(c()).toBeNull()
  })

  test("computed returning undefined", () => {
    const [x] = createSignal<string | undefined>(undefined)
    const c = createComputed(() => x())
    expect(c()).toBeUndefined()
  })

  test("deeply nested computed chain 5 levels", () => {
    const [a, setA] = createSignal(1)
    const b = createComputed(() => a() + 1)
    const c = createComputed(() => b() + 1)
    const d = createComputed(() => c() + 1)
    const e = createComputed(() => d() + 1)
    const f = createComputed(() => e() + 1)
    expect(f()).toBe(6)
    setA(10)
    expect(f()).toBe(15)
  })

  test("computed from store getter", () => {
    const [store, setStore] = createStore({ count: 1, name: "test" })
    const display = createComputed(() => `${store.name()}: ${store.count()}`)
    expect(display()).toBe("test: 1")
    setStore("count", 99)
    expect(display()).toBe("test: 99")
  })

  test("computed with reduce", () => {
    const [nums, setNums] = createSignal([1, 2, 3, 4])
    const total = createComputed(() => nums().reduce((s, n) => s + n, 0))
    expect(total()).toBe(10)
    setNums([10, 20])
    expect(total()).toBe(30)
  })

  test("computed with ternary returning different types", () => {
    const [flag, setFlag] = createSignal(true)
    const c = createComputed(() => (flag() ? 1 : "off"))
    expect(c()).toBe(1)
    setFlag(false)
    expect(c()).toBe("off")
  })

  test("computed tracks new dependencies after conditional change", () => {
    const [branch, setBranch] = createSignal<"a" | "b">("a")
    const [a] = createSignal(10)
    const [b, setB] = createSignal(20)
    const val = createComputed(() => (branch() === "a" ? a() : b()))
    expect(val()).toBe(10)
    setBranch("b")
    expect(val()).toBe(20)
    setB(30)
    expect(val()).toBe(30)
  })

  test("computed used inside effect", () => {
    const [x, setX] = createSignal(1)
    const doubled = createComputed(() => x() * 2)
    const log: number[] = []
    createEffect(() => { log.push(doubled()) })
    setX(2)
    setX(3)
    expect(log).toEqual([2, 4, 6])
  })

  test("multiple computeds from same signal", () => {
    const [x, setX] = createSignal(5)
    const a = createComputed(() => x() + 1)
    const b = createComputed(() => x() * 2)
    expect(a()).toBe(6)
    expect(b()).toBe(10)
    setX(10)
    expect(a()).toBe(11)
    expect(b()).toBe(20)
  })
})
