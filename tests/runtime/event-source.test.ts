import { afterEach, describe, expect, it } from "bun:test"
import { createEventSource } from "../../src/runtime/event-source.ts"

const originalEventSource = globalThis.EventSource

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  listeners = new Map<string, Set<(event?: unknown) => void>>()
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event?: unknown) => void): void {
    const existing = this.listeners.get(type) ?? new Set()
    existing.add(listener)
    this.listeners.set(type, existing)
  }

  emit(type: string, event?: unknown): void {
    const listeners = this.listeners.get(type)
    if (!listeners) return
    for (const listener of listeners) listener(event)
  }

  close(): void {
    this.closed = true
  }
}

afterEach(() => {
  MockEventSource.instances.length = 0
  if (originalEventSource === undefined) {
    delete (globalThis as Record<string, unknown>).EventSource
  } else {
    globalThis.EventSource = originalEventSource
  }
})

describe("createEventSource", () => {
  it("falls back cleanly when EventSource is unavailable", () => {
    delete (globalThis as Record<string, unknown>).EventSource

    const signal = createEventSource("/events", "update", 1)

    expect(signal.value()).toBe(1)
    expect(signal.connected()).toBe(false)
    signal.close()
  })

  it("updates reactive state from events", () => {
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const signal = createEventSource("/events", "update", { count: 0 })
    const source = MockEventSource.instances[0]!

    source.emit("open")
    expect(signal.connected()).toBe(true)

    source.emit("update", { data: JSON.stringify({ count: 2 }) })
    expect(signal.value()).toEqual({ count: 2 })

    source.emit("error")
    expect(signal.connected()).toBe(false)
  })

  it("ignores malformed event payloads", () => {
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const signal = createEventSource("/events", "update", { count: 0 })
    const source = MockEventSource.instances[0]!

    source.emit("update", { data: "not-json" })
    expect(signal.value()).toEqual({ count: 0 })
  })

  it("closes the underlying source", () => {
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const signal = createEventSource("/events", "update", { count: 0 })
    const source = MockEventSource.instances[0]!

    signal.close()
    expect(source.closed).toBe(true)
    expect(signal.connected()).toBe(false)
  })
})
