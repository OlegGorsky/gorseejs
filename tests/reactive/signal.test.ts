import { describe, test, expect } from "bun:test"
import { createSignal } from "../../src/reactive/signal.ts"
import { createComputed } from "../../src/reactive/computed.ts"
import { createEffect } from "../../src/reactive/effect.ts"
import { isRenderableThunk, isSignal } from "../../src/runtime/html-escape.ts"

describe("createSignal", () => {
  test("returns initial value", () => {
    const [count] = createSignal(0)
    expect(count()).toBe(0)
  })

  test("updates value", () => {
    const [count, setCount] = createSignal(0)
    setCount(5)
    expect(count()).toBe(5)
  })

  test("updates with function", () => {
    const [count, setCount] = createSignal(10)
    setCount((prev) => prev + 5)
    expect(count()).toBe(15)
  })

  test("works with string values", () => {
    const [name, setName] = createSignal("hello")
    setName("world")
    expect(name()).toBe("world")
  })

  test("marks getter as signal instead of generic render thunk", () => {
    const [count] = createSignal(0)

    expect(isSignal(count)).toBe(true)
    expect(isRenderableThunk(count)).toBe(false)
  })
})

describe("createComputed", () => {
  test("derives from signal", () => {
    const [count] = createSignal(3)
    const doubled = createComputed(() => count() * 2)
    expect(doubled()).toBe(6)
  })

  test("updates when dependency changes", () => {
    const [count, setCount] = createSignal(3)
    const doubled = createComputed(() => count() * 2)
    setCount(10)
    expect(doubled()).toBe(20)
  })

  test("diamond dependency", () => {
    const [a, setA] = createSignal(1)
    const b = createComputed(() => a() * 2)
    const c = createComputed(() => a() * 3)
    const d = createComputed(() => b() + c())

    expect(d()).toBe(5) // 2 + 3
    setA(2)
    expect(d()).toBe(10) // 4 + 6
  })

  test("marks computed getter as signal instead of generic render thunk", () => {
    const [count] = createSignal(3)
    const doubled = createComputed(() => count() * 2)

    expect(isSignal(doubled)).toBe(true)
    expect(isRenderableThunk(doubled)).toBe(false)
  })
})

describe("createEffect", () => {
  test("runs on dependency change", () => {
    const [count, setCount] = createSignal(0)
    const values: number[] = []

    createEffect(() => {
      values.push(count())
    })

    setCount(1)
    setCount(2)

    expect(values).toEqual([0, 1, 2])
  })

  test("cleanup stops tracking", () => {
    const [count, setCount] = createSignal(0)
    const values: number[] = []

    const stop = createEffect(() => {
      values.push(count())
    })

    setCount(1)
    stop()
    setCount(2)

    expect(values).toEqual([0, 1])
  })
})
