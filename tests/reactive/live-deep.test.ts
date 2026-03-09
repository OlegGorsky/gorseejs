import { describe, test, expect } from "bun:test"
import { createLive } from "../../src/reactive/live.ts"

describe("createLive deep", () => {
  test("returns value, connected, send, close", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: "init" })
    expect(live.value).toBeDefined()
    expect(live.connected).toBeDefined()
    expect(typeof live.send).toBe("function")
    expect(typeof live.close).toBe("function")
    live.close()
  })

  test("initial value is set correctly", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: 42 })
    expect(live.value()).toBe(42)
    live.close()
  })

  test("initial value with object", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: { x: 1 } })
    expect(live.value()).toEqual({ x: 1 })
    live.close()
  })

  test("initial value with array", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: [1, 2, 3] })
    expect(live.value()).toEqual([1, 2, 3])
    live.close()
  })

  test("initial value with null", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: null })
    expect(live.value()).toBeNull()
    live.close()
  })

  test("send does not throw when not connected", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: "" })
    // send when ws is not open — should be a no-op
    expect(() => live.send("hello")).not.toThrow()
    live.close()
  })

  test("close can be called multiple times", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: 0 })
    live.close()
    live.close()
    live.close()
    expect(live.connected()).toBe(false)
  })

  test("multiple createLive instances are independent", () => {
    const live1 = createLive({ url: "ws://localhost:9991", initialValue: "a" })
    const live2 = createLive({ url: "ws://localhost:9992", initialValue: "b" })
    expect(live1.value()).toBe("a")
    expect(live2.value()).toBe("b")
    live1.close()
    live2.close()
  })

  test("options with reconnect false", () => {
    const live = createLive({
      url: "ws://localhost:9999",
      initialValue: 0,
      reconnect: false,
    })
    expect(live.value()).toBe(0)
    live.close()
  })

  test("options with custom reconnectDelay", () => {
    const live = createLive({
      url: "ws://localhost:9999",
      initialValue: 0,
      reconnectDelay: 5000,
    })
    expect(live.value()).toBe(0)
    live.close()
  })

  test("options with transform function", () => {
    const live = createLive({
      url: "ws://localhost:9999",
      initialValue: "",
      transform: (data: unknown) => String(data).toUpperCase(),
    })
    // transform is only called on message, initial value is untransformed
    expect(live.value()).toBe("")
    live.close()
  })

  test("value and connected are callable getters", () => {
    const live = createLive({ url: "ws://localhost:9999", initialValue: "test" })
    expect(typeof live.value).toBe("function")
    expect(typeof live.connected).toBe("function")
    live.close()
  })
})
