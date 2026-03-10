import { afterEach, describe, expect, test } from "bun:test"
import {
  claimElement,
  claimText,
  enterHydration,
  exitHydration,
  getHydrationDiagnostics,
  getHydrationMismatches,
  isHydrating,
  resetHydrationDiagnostics,
} from "../../src/runtime/hydration.ts"
import { EVENT_REPLAY_SCRIPT, replayEvents, stopEventCapture } from "../../src/runtime/event-replay.ts"
import { useFormAction } from "../../src/runtime/form.ts"
import { hydrateIslands, registerIsland } from "../../src/runtime/island-hydrator.ts"

const originalConsoleWarn = console.warn
const originalDocument = globalThis.document
const originalIntersectionObserver = globalThis.IntersectionObserver
const originalFetch = globalThis.fetch
const originalLocation = globalThis.location
const originalReplay = (globalThis as Record<string, unknown>).__gorsee_events

afterEach(() => {
  console.warn = originalConsoleWarn
  ;(globalThis as Record<string, unknown>).document = originalDocument
  ;(globalThis as Record<string, unknown>).IntersectionObserver = originalIntersectionObserver
  ;(globalThis as Record<string, unknown>).__gorsee_events = originalReplay
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: originalLocation,
  })
})

function textNode(textContent: string) {
  return {
    nodeType: 3,
    textContent,
    splitText(offset: number) {
      const remainder = textNode(textContent.slice(offset))
      this.textContent = textContent.slice(0, offset)
      return remainder
    },
  }
}

function createIslandElement(attributes: Record<string, string>) {
  return {
    childNodes: [] as unknown[],
    getAttribute(name: string) {
      return attributes[name] ?? null
    },
    hasAttribute(name: string) {
      return name in attributes
    },
  }
}

function commentNode(textContent = "") {
  return {
    nodeType: 8,
    textContent,
  }
}

function elementNode(tagName: string) {
  return {
    nodeType: 1,
    tagName,
    childNodes: [],
  }
}

describe("runtime negative paths", () => {
  test("claimText rewrites mismatched text content and records a mismatch", () => {
    const root = {
      childNodes: [textNode("server-value")],
    }

    resetHydrationDiagnostics()
    enterHydration(root as unknown as Element)
    const claimed = claimText("client-value")
    exitHydration()

    expect(claimed?.textContent).toBe("client-value")
    expect(getHydrationMismatches()).toBe(1)
  })

  test("claimElement skips whitespace text nodes and comments before matching element", () => {
    const element = elementNode("section")
    const root = {
      childNodes: [textNode("  \n"), commentNode("ssr"), element],
    }

    resetHydrationDiagnostics()
    enterHydration(root as unknown as Element)
    const claimed = claimElement("section")
    exitHydration()

    expect(claimed).toBe(element as unknown as Element)
    expect(getHydrationMismatches()).toBe(0)
  })

  test("claimText returns null when next meaningful node is an element", () => {
    const root = {
      childNodes: [commentNode("skip"), elementNode("div"), textNode("later")],
    }

    resetHydrationDiagnostics()
    enterHydration(root as unknown as Element)
    const claimed = claimText("client")
    exitHydration()

    expect(claimed).toBeNull()
  })

  test("replay helpers ignore malformed global replay hooks", () => {
    ;(globalThis as Record<string, unknown>).__gorsee_events = {
      queue: [],
      replay: "broken",
      stop: 123,
    }

    expect(() => replayEvents({} as Element)).not.toThrow()
    expect(() => stopEventCapture()).not.toThrow()
  })

  test("replay helpers ignore replay hooks that throw at runtime", () => {
    ;(globalThis as Record<string, unknown>).__gorsee_events = {
      queue: [],
      replay() {
        throw new Error("replay exploded")
      },
      stop() {
        throw new Error("stop exploded")
      },
    }

    expect(() => replayEvents({} as Element)).not.toThrow()
    expect(() => stopEventCapture()).not.toThrow()
  })

  test("hydrateIslands falls back to empty props on malformed data-props JSON", async () => {
    const warnings: string[] = []
    const replayed: unknown[] = []
    let receivedProps: Record<string, unknown> | undefined
    const element = createIslandElement({
      "data-island": "BrokenPropsIsland",
      "data-props": "{bad-json",
    })

    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn
    ;(globalThis as Record<string, unknown>).__gorsee_events = {
      queue: [],
      replay(root: Element) {
        replayed.push(root)
      },
      stop() {},
    }
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll(selector: string) {
        expect(selector).toBe("[data-island]")
        return [element]
      },
    }

    registerIsland("BrokenPropsIsland", async () => ({
      default(props: Record<string, unknown>) {
        receivedProps = props
        return null
      },
    }))

    hydrateIslands()
    await Promise.resolve()
    await Promise.resolve()

    expect(receivedProps).toEqual({})
    expect(replayed).toEqual([element])
    expect(warnings.join("\n")).toContain("Failed to parse island props")
  })

  test("hydrateIslands keeps successful hydration stable even if replay hook throws", async () => {
    const warnings: string[] = []
    let hydrateCalls = 0
    const element = createIslandElement({
      "data-island": "ReplayThrowIsland",
      "data-props": "{}",
    })

    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn
    ;(globalThis as Record<string, unknown>).__gorsee_events = {
      queue: [],
      replay() {
        throw new Error("replay exploded")
      },
      stop() {},
    }
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll() {
        return [element]
      },
    }

    registerIsland("ReplayThrowIsland", async () => ({
      default() {
        hydrateCalls += 1
        return null
      },
    }))

    hydrateIslands()
    await Promise.resolve()
    await Promise.resolve()

    hydrateIslands()
    await Promise.resolve()
    await Promise.resolve()

    expect(hydrateCalls).toBe(1)
    expect(warnings.join("\n")).not.toContain('Island "ReplayThrowIsland" hydration failed')
  })

  test("hydrateIslands normalizes non-object decoded props payloads to an empty object", async () => {
    const warnings: string[] = []
    const received: Array<Record<string, unknown> | undefined> = []
    const elements = [
      createIslandElement({
        "data-island": "StrictPropsIslandNull",
        "data-props": "null",
      }),
      createIslandElement({
        "data-island": "StrictPropsIslandArray",
        "data-props": "[1,2,3]",
      }),
      createIslandElement({
        "data-island": "StrictPropsIslandString",
        "data-props": "\"bad\"",
      }),
    ]

    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn
    ;(globalThis as Record<string, unknown>).__gorsee_events = {
      queue: [],
      replay() {},
      stop() {},
    }
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll() {
        return elements
      },
    }

    registerIsland("StrictPropsIslandNull", async () => ({
      default(props: Record<string, unknown>) {
        received.push(props)
        return null
      },
    }))
    registerIsland("StrictPropsIslandArray", async () => ({
      default(props: Record<string, unknown>) {
        received.push(props)
        return null
      },
    }))
    registerIsland("StrictPropsIslandString", async () => ({
      default(props: Record<string, unknown>) {
        received.push(props)
        return null
      },
    }))

    hydrateIslands()
    await Promise.resolve()
    await Promise.resolve()

    expect(received).toEqual([{}, {}, {}])
    expect(warnings.join("\n")).toContain("Island props payload must decode to an object")
  })

  test("hydrateIslands ignores malformed replay loader hooks and missing islands without throwing", async () => {
    const warnings: string[] = []
    const element = createIslandElement({
      "data-island": "MissingIslandRuntime",
      "data-props": "{}",
    })

    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn
    ;(globalThis as Record<string, unknown>).__gorsee_events = {
      queue: [],
      replay: "bad",
      stop: null,
    }
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll() {
        return [element]
      },
    }

    hydrateIslands()
    await Promise.resolve()

    expect(warnings.join("\n")).toContain('Island "MissingIslandRuntime" not found in registry')
  })

  test("lazy islands hydrate only once even if IntersectionObserver reports multiple intersections", async () => {
    const observed: unknown[] = []
    const unobserved: unknown[] = []
    let callback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined
    let hydrateCalls = 0
    const element = createIslandElement({
      "data-island": "LazyIslandOnce",
      "data-props": "{}",
      "data-island-lazy": "true",
    })

    class FakeIntersectionObserver {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        callback = cb
      }
      observe(target: unknown) {
        observed.push(target)
      }
      unobserve(target: unknown) {
        unobserved.push(target)
      }
    }

    ;(globalThis as Record<string, unknown>).IntersectionObserver = FakeIntersectionObserver
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll() {
        return [element]
      },
    }
    registerIsland("LazyIslandOnce", async () => ({
      default() {
        hydrateCalls += 1
        return null
      },
    }))

    hydrateIslands()
    expect(observed).toEqual([element])

    callback?.([{ isIntersecting: true }, { isIntersecting: true }])
    await Promise.resolve()
    await Promise.resolve()

    expect(unobserved).toEqual([element])
    expect(hydrateCalls).toBe(1)
  })

  test("lazy islands can retry after a transient loader failure", async () => {
    const warnings: string[] = []
    const observed: unknown[] = []
    const unobserved: unknown[] = []
    let callback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined
    let attempts = 0
    let hydrateCalls = 0
    const element = createIslandElement({
      "data-island": "RetryLazyIsland",
      "data-props": "{}",
      "data-island-lazy": "true",
    })

    class FakeIntersectionObserver {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        callback = cb
      }
      observe(target: unknown) {
        observed.push(target)
      }
      unobserve(target: unknown) {
        unobserved.push(target)
      }
    }

    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn
    ;(globalThis as Record<string, unknown>).IntersectionObserver = FakeIntersectionObserver
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll() {
        return [element]
      },
    }
    registerIsland("RetryLazyIsland", async () => {
      attempts += 1
      if (attempts === 1) throw new Error("transient island import failure")
      return {
        default() {
          hydrateCalls += 1
          return null
        },
      }
    })

    hydrateIslands()
    expect(observed).toEqual([element])

    callback?.([{ isIntersecting: true }])
    await Promise.resolve()
    await Promise.resolve()

    expect(hydrateCalls).toBe(0)
    expect(unobserved).toEqual([element])

    hydrateIslands()
    expect(observed).toEqual([element, element])

    callback?.([{ isIntersecting: true }])
    await Promise.resolve()
    await Promise.resolve()

    expect(hydrateCalls).toBe(1)
    expect(warnings.join("\n")).toContain('Island "RetryLazyIsland" hydration failed')
  })

  test("island hydration can retry after a module default accessor throws", async () => {
    const warnings: string[] = []
    let attempts = 0
    let hydrateCalls = 0
    const element = createIslandElement({
      "data-island": "AccessorThrowIsland",
      "data-props": "{}",
    })

    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn
    ;(globalThis as Record<string, unknown>).__gorsee_events = {
      queue: [],
      replay() {},
      stop() {},
    }
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll() {
        return [element]
      },
    }
    registerIsland("AccessorThrowIsland", async () => {
      attempts += 1
      if (attempts === 1) {
        return Object.defineProperty({}, "default", {
          get() {
            throw new Error("module accessor exploded")
          },
        }) as { default: (props: Record<string, unknown>) => unknown }
      }
      return {
        default() {
          hydrateCalls += 1
          return null
        },
      }
    })

    hydrateIslands()
    await Promise.resolve()
    await Promise.resolve()

    expect(hydrateCalls).toBe(0)

    hydrateIslands()
    await Promise.resolve()
    await Promise.resolve()

    expect(hydrateCalls).toBe(1)
    expect(warnings.join("\n")).toContain('Island "AccessorThrowIsland" hydration failed')
  })

  test("failed island hydration resets hydration context so later islands can still hydrate", async () => {
    const warnings: string[] = []
    const seen: string[] = []
    const broken = createIslandElement({
      "data-island": "BrokenDuringHydration",
      "data-props": "{}",
    })
    const healthy = createIslandElement({
      "data-island": "HealthyAfterFailure",
      "data-props": "{}",
    })

    console.warn = ((message?: unknown) => {
      warnings.push(String(message ?? ""))
    }) as typeof console.warn
    ;(globalThis as Record<string, unknown>).document = {
      querySelectorAll() {
        return [broken, healthy]
      },
    }
    registerIsland("BrokenDuringHydration", async () => ({
      default() {
        seen.push("broken-start")
        throw new Error("hydration component failure")
      },
    }))
    registerIsland("HealthyAfterFailure", async () => ({
      default() {
        seen.push("healthy")
        return null
      },
    }))

    hydrateIslands()
    await Promise.resolve()
    await Promise.resolve()

    expect(seen).toEqual(["broken-start", "healthy"])
    expect(isHydrating()).toBe(false)
    expect(getHydrationDiagnostics()).toEqual({
      active: false,
      mismatches: 0,
      recoverableMismatch: false,
    })
    expect(warnings.join("\n")).toContain('Island "BrokenDuringHydration" hydration failed')
  })

  test("event replay script keeps submit prevention, root scoping, and queue clearing", () => {
    expect(EVENT_REPLAY_SCRIPT).toContain('if(e.type==="submit")e.preventDefault();')
    expect(EVENT_REPLAY_SCRIPT).toContain("if(ev.target&&root.contains(ev.target))")
    expect(EVENT_REPLAY_SCRIPT).toContain("Q.length=0;")
  })

  test("useFormAction surfaces malformed JSON responses as runtime errors", async () => {
    globalThis.fetch = ((async () => new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown) as typeof fetch
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { pathname: "/broken-submit" },
    })

    const form = useFormAction<{ optimistic: boolean }>()
    const result = await form.submit({ email: "user@example.com" }, {
      optimisticData: { optimistic: true },
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(typeof result.error).toBe("string")
    expect(result.error?.length).toBeGreaterThan(0)
    expect(form.status()).toBe("error")
    expect(form.error()).toBe(result.error)
    expect(form.data()).toEqual({ optimistic: true })
    expect(form.submitting()).toBe(false)
  })

  test("useFormAction rejects syntactically valid but non-object JSON payloads", async () => {
    globalThis.fetch = ((async () => new Response("[1,2,3]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown) as typeof fetch
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { pathname: "/broken-shape-submit" },
    })

    const form = useFormAction<{ optimistic: boolean }>()
    const result = await form.submit({ email: "user@example.com" }, {
      optimisticData: { optimistic: true },
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toBe("Malformed form action response")
    expect(form.status()).toBe("error")
    expect(form.error()).toBe("Malformed form action response")
    expect(form.data()).toEqual({ optimistic: true })
    expect(form.submitting()).toBe(false)
  })

  test("useFormAction clears stale errors on a successful retry and respects explicit actionUrl", async () => {
    const urls: string[] = []
    let call = 0

    globalThis.fetch = ((async (input: RequestInfo | URL) => {
      urls.push(String(input))
      call += 1
      if (call === 1) {
        return new Response(JSON.stringify({
          ok: false,
          status: 400,
          error: "Validation failed",
          fieldErrors: { email: ["Email is required"] },
          formErrors: ["Try again"],
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({
        ok: true,
        status: 200,
        data: { saved: true },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown) as typeof fetch
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { pathname: "/ignored-location" },
    })

    const form = useFormAction<{ saved: boolean }>("/explicit-submit")

    const failed = await form.submit({ email: "" })
    expect(failed.ok).toBe(false)
    expect(form.status()).toBe("error")
    expect(form.error()).toBe("Validation failed")
    expect(form.formErrors()).toEqual(["Try again"])
    expect(form.fieldErrors()).toEqual({ email: ["Email is required"] })

    const success = await form.submit({ email: "user@example.com" })
    expect(success.ok).toBe(true)
    expect(form.status()).toBe("success")
    expect(form.error()).toBeUndefined()
    expect(form.formErrors()).toEqual([])
    expect(form.fieldErrors()).toEqual({})
    expect(form.data()).toEqual({ saved: true })
    expect(urls).toEqual(["/explicit-submit", "/explicit-submit"])
  })

  test("useFormAction stringifies non-Error thrown values into runtime errors", async () => {
    globalThis.fetch = ((async () => {
      throw "network exploded"
    }) as unknown) as typeof fetch
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { pathname: "/string-throw-submit" },
    })

    const form = useFormAction()
    const result = await form.submit({ email: "user@example.com" })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toBe("network exploded")
    expect(form.status()).toBe("error")
    expect(form.error()).toBe("network exploded")
  })
})
