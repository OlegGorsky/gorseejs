import { describe, test, expect } from "bun:test"
import { createSignal } from "../../src/reactive/signal.ts"
import { createComputed } from "../../src/reactive/computed.ts"
import { createEffect } from "../../src/reactive/effect.ts"

describe("createEffect deep", () => {
  test("effect runs immediately with initial value", () => {
    const [val] = createSignal(42)
    let captured = 0
    createEffect(() => { captured = val() })
    expect(captured).toBe(42)
  })

  test("effect tracks multiple signals", () => {
    const [a, setA] = createSignal(1)
    const [b, setB] = createSignal(2)
    const sums: number[] = []
    createEffect(() => { sums.push(a() + b()) })
    setA(10)
    setB(20)
    expect(sums).toEqual([3, 12, 30])
  })

  test("effect disposal stops tracking", () => {
    const [val, set] = createSignal(0)
    const log: number[] = []
    const stop = createEffect(() => { log.push(val()) })
    set(1)
    set(2)
    stop()
    set(3)
    set(4)
    expect(log).toEqual([0, 1, 2])
  })

  test("effect that modifies another signal", () => {
    const [source, setSource] = createSignal(1)
    const [derived, setDerived] = createSignal(0)
    createEffect(() => { setDerived(source() * 10) })
    expect(derived()).toBe(10)
    setSource(5)
    expect(derived()).toBe(50)
  })

  test("effect running count", () => {
    const [val, set] = createSignal("a")
    let runs = 0
    createEffect(() => { val(); runs++ })
    expect(runs).toBe(1)
    set("b")
    expect(runs).toBe(2)
    set("c")
    expect(runs).toBe(3)
  })

  test("effect does not run when signal set to same value", () => {
    const [val, set] = createSignal(10)
    let runs = 0
    createEffect(() => { val(); runs++ })
    expect(runs).toBe(1)
    set(10)
    expect(runs).toBe(1)
    set(10)
    expect(runs).toBe(1)
  })

  test("effect with array signal changes", () => {
    const [arr, setArr] = createSignal([1, 2])
    const lengths: number[] = []
    createEffect(() => { lengths.push(arr().length) })
    setArr([1, 2, 3])
    setArr([])
    expect(lengths).toEqual([2, 3, 0])
  })

  test("effect with computed dependency", () => {
    const [x, setX] = createSignal(3)
    const doubled = createComputed(() => x() * 2)
    const log: number[] = []
    createEffect(() => { log.push(doubled()) })
    setX(5)
    setX(10)
    expect(log).toEqual([6, 10, 20])
  })

  test("nested effects run independently", () => {
    const [a, setA] = createSignal(0)
    const [b, setB] = createSignal(0)
    const outerLog: number[] = []
    const innerLog: number[] = []

    createEffect(() => {
      outerLog.push(a())
      createEffect(() => { innerLog.push(b()) })
    })

    setB(1)
    expect(innerLog.length).toBeGreaterThanOrEqual(2)
  })

  test("effect with conditional signal access", () => {
    const [flag, setFlag] = createSignal(true)
    const [a] = createSignal("A")
    const [b, setB] = createSignal("B")
    const log: string[] = []

    createEffect(() => {
      log.push(flag() ? a() : b())
    })

    expect(log).toEqual(["A"])
    setFlag(false)
    expect(log).toEqual(["A", "B"])
    // now tracking b, changing b should trigger
    setB("B2")
    expect(log).toEqual(["A", "B", "B2"])
  })

  test("multiple effects on same signal", () => {
    const [val, set] = createSignal(0)
    const log1: number[] = []
    const log2: number[] = []
    createEffect(() => { log1.push(val()) })
    createEffect(() => { log2.push(val()) })
    set(1)
    expect(log1).toEqual([0, 1])
    expect(log2).toEqual([0, 1])
  })

  test("effect sees latest value after multiple sets", () => {
    const [val, set] = createSignal(0)
    const log: number[] = []
    createEffect(() => { log.push(val()) })
    set(1)
    set(2)
    set(3)
    expect(log[log.length - 1]).toBe(3)
  })

  test("disposed effect does not leak", () => {
    const [val, set] = createSignal(0)
    let runs = 0
    const stop = createEffect(() => { val(); runs++ })
    stop()
    for (let i = 0; i < 100; i++) set(i)
    expect(runs).toBe(1) // only initial
  })

  test("effect with object signal triggers on new reference", () => {
    const [obj, setObj] = createSignal({ x: 1 })
    let runs = 0
    createEffect(() => { obj(); runs++ })
    expect(runs).toBe(1)
    setObj({ x: 1 }) // new ref, same shape
    expect(runs).toBe(2)
  })

  test("effect with boolean toggle", () => {
    const [flag, setFlag] = createSignal(false)
    const log: boolean[] = []
    createEffect(() => { log.push(flag()) })
    setFlag(true)
    setFlag(false)
    setFlag(true)
    expect(log).toEqual([false, true, false, true])
  })

  test("effect returns cleanup function type", () => {
    const [val] = createSignal(0)
    const stop = createEffect(() => { val() })
    expect(typeof stop).toBe("function")
    stop()
  })

  test("effect triggered by computed chain", () => {
    const [a, setA] = createSignal(1)
    const b = createComputed(() => a() + 1)
    const c = createComputed(() => b() * 2)
    const log: number[] = []
    createEffect(() => { log.push(c()) })
    setA(5)
    expect(log).toEqual([4, 12])
  })

  test("effect with string signal concatenation", () => {
    const [first, setFirst] = createSignal("Hello")
    const [last, setLast] = createSignal("World")
    const log: string[] = []
    createEffect(() => { log.push(`${first()} ${last()}`) })
    setFirst("Hi")
    setLast("There")
    expect(log).toEqual(["Hello World", "Hi World", "Hi There"])
  })

  test("stop multiple effects independently", () => {
    const [val, set] = createSignal(0)
    const log1: number[] = []
    const log2: number[] = []
    const stop1 = createEffect(() => { log1.push(val()) })
    const stop2 = createEffect(() => { log2.push(val()) })
    set(1)
    stop1()
    set(2)
    stop2()
    set(3)
    expect(log1).toEqual([0, 1])
    expect(log2).toEqual([0, 1, 2])
  })
})
