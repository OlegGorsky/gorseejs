import { describe, test, expect } from "bun:test"
import { createStore } from "../../src/reactive/store.ts"
import { createComputed } from "../../src/reactive/computed.ts"
import { createEffect } from "../../src/reactive/effect.ts"

describe("createStore deep", () => {
  test("basic store get returns initial values", () => {
    const [store] = createStore({ name: "Alice", age: 30 })
    expect(store.name()).toBe("Alice")
    expect(store.age()).toBe(30)
  })

  test("setStore updates a key", () => {
    const [store, setStore] = createStore({ x: 1, y: 2 })
    setStore("x", 10)
    expect(store.x()).toBe(10)
    expect(store.y()).toBe(2)
  })

  test("setStore with function updater", () => {
    const [store, setStore] = createStore({ count: 5 })
    setStore("count", (prev) => prev + 1)
    expect(store.count()).toBe(6)
  })

  test("store with nested object value", () => {
    const [store, setStore] = createStore({ data: { x: 1, y: 2 } })
    expect(store.data()).toEqual({ x: 1, y: 2 })
    setStore("data", { x: 10, y: 20 })
    expect(store.data()).toEqual({ x: 10, y: 20 })
  })

  test("store partial update - other keys unaffected", () => {
    const [store, setStore] = createStore({ a: 1, b: 2, c: 3 })
    setStore("b", 20)
    expect(store.a()).toBe(1)
    expect(store.b()).toBe(20)
    expect(store.c()).toBe(3)
  })

  test("store array operations via setStore", () => {
    const [store, setStore] = createStore({ items: [1, 2, 3] })
    setStore("items", (prev) => [...prev, 4])
    expect(store.items()).toEqual([1, 2, 3, 4])
  })

  test("store with multiple keys updated sequentially", () => {
    const [store, setStore] = createStore({ x: 0, y: 0, z: 0 })
    setStore("x", 1)
    setStore("y", 2)
    setStore("z", 3)
    expect(store.x()).toBe(1)
    expect(store.y()).toBe(2)
    expect(store.z()).toBe(3)
  })

  test("store replace entire nested value", () => {
    const [store, setStore] = createStore({ config: { debug: true, level: 3 } })
    setStore("config", { debug: false, level: 0 })
    expect(store.config()).toEqual({ debug: false, level: 0 })
  })

  test("store with computed derived values", () => {
    const [store, setStore] = createStore({ width: 10, height: 5 })
    const area = createComputed(() => store.width() * store.height())
    expect(area()).toBe(50)
    setStore("width", 20)
    expect(area()).toBe(100)
  })

  test("store reset to initial by setting all keys", () => {
    const [store, setStore] = createStore({ a: 0, b: "" })
    setStore("a", 42)
    setStore("b", "hello")
    expect(store.a()).toBe(42)
    setStore("a", 0)
    setStore("b", "")
    expect(store.a()).toBe(0)
    expect(store.b()).toBe("")
  })

  test("store with null fields", () => {
    const [store, setStore] = createStore({ value: null as string | null })
    expect(store.value()).toBeNull()
    setStore("value", "hello")
    expect(store.value()).toBe("hello")
    setStore("value", null)
    expect(store.value()).toBeNull()
  })

  test("store with boolean fields", () => {
    const [store, setStore] = createStore({ active: false, visible: true })
    expect(store.active()).toBe(false)
    setStore("active", true)
    expect(store.active()).toBe(true)
    setStore("visible", (v) => !v)
    expect(store.visible()).toBe(false)
  })

  test("store update does not trigger effect if value unchanged", () => {
    const [store, setStore] = createStore({ count: 5 })
    let runs = 0
    createEffect(() => { store.count(); runs++ })
    expect(runs).toBe(1)
    setStore("count", 5)
    expect(runs).toBe(1)
  })

  test("accessing nonexistent key returns undefined", () => {
    const [store] = createStore({ x: 1 })
    expect((store as any).nonexistent).toBeUndefined()
  })

  test("setStore on nonexistent key is a no-op", () => {
    const [store, setStore] = createStore({ x: 1 })
    ;(setStore as any)("missing", 42)
    expect((store as any).missing).toBeUndefined()
  })

  test("store effect fires only for changed key", () => {
    const [store, setStore] = createStore({ a: 1, b: 2 })
    const logA: number[] = []
    const logB: number[] = []
    createEffect(() => { logA.push(store.a()) })
    createEffect(() => { logB.push(store.b()) })
    setStore("a", 10)
    expect(logA).toEqual([1, 10])
    expect(logB).toEqual([2]) // b not triggered
  })

  test("store with string values", () => {
    const [store, setStore] = createStore({ greeting: "hello", target: "world" })
    const full = createComputed(() => `${store.greeting()} ${store.target()}`)
    expect(full()).toBe("hello world")
    setStore("greeting", "hi")
    expect(full()).toBe("hi world")
  })

  test("store functional update with array filter", () => {
    const [store, setStore] = createStore({ nums: [1, 2, 3, 4, 5] })
    setStore("nums", (prev) => prev.filter((n) => n % 2 === 0))
    expect(store.nums()).toEqual([2, 4])
  })

  test("store with many rapid updates", () => {
    const [store, setStore] = createStore({ val: 0 })
    for (let i = 0; i < 100; i++) setStore("val", (v) => v + 1)
    expect(store.val()).toBe(100)
  })

  test("store getters are stable references", () => {
    const [store] = createStore({ x: 1 })
    const getter1 = store.x
    const getter2 = store.x
    expect(getter1).toBe(getter2)
  })
})
