import { describe, expect, test } from "bun:test"
import { captureNavigationSnapshot, initRouter, restoreNavigationSnapshot } from "../../src/runtime/router.ts"

describe("router state preservation", () => {
  test("captures and restores form values and focus by preserve key", () => {
    const originalDocument = globalThis.document

    const focusedTarget = {
      getAttribute(name: string) {
        return name === "data-g-preserve-key" ? "title" : null
      },
      name: "",
      id: "",
    }

    const sourceInput = {
      getAttribute(name: string) {
        return name === "data-g-preserve-key" ? "title" : null
      },
      name: "title",
      id: "",
      value: "Hello",
      checked: false,
    }

    const sourceCheckbox = {
      getAttribute() { return null },
      name: "published",
      id: "",
      value: "",
      checked: true,
      type: "checkbox",
    }

    let focused = false
    const restoredInput = {
      value: "",
      checked: false,
      focus() {
        focused = true
      },
    }
    const restoredCheckbox = {
      value: "",
      checked: false,
    }

    const sourceContainer = {
      contains(node: unknown) {
        return node === focusedTarget
      },
      querySelectorAll() {
        return [sourceInput, sourceCheckbox]
      },
    }

    const restoredContainer = {
      querySelector(selector: string) {
        if (selector.includes("title")) return restoredInput
        if (selector.includes("published")) return restoredCheckbox
        return null
      },
    }

    ;(globalThis as Record<string, unknown>).document = {
      activeElement: focusedTarget,
    }

    try {
      const snapshot = captureNavigationSnapshot(sourceContainer as unknown as Element)
      restoreNavigationSnapshot(restoredContainer as unknown as Element, snapshot)

      expect(snapshot.focusKey).toBe("title")
      expect(restoredInput.value).toBe("Hello")
      expect(restoredCheckbox.checked).toBe(true)
      expect(focused).toBe(true)
    } finally {
      ;(globalThis as Record<string, unknown>).document = originalDocument
    }
  })

  test("falls back to the last focused preserve key when navigation moves focus onto a link", () => {
    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location

    const listeners = new Map<string, Array<(event: { target?: unknown }) => void>>()
    const preservedInput = {
      getAttribute(name: string) {
        return name === "data-g-preserve-key" ? "draft" : null
      },
      name: "draft",
      id: "",
      value: "kept",
      checked: false,
    }
    const activeLink = {
      getAttribute() { return null },
      name: "",
      id: "about-link",
    }
    const container = {
      contains(node: unknown) {
        return node === preservedInput || node === activeLink
      },
      querySelectorAll() {
        return [preservedInput]
      },
    }

    ;(globalThis as Record<string, unknown>).document = {
      activeElement: activeLink,
      getElementById(id: string) {
        return id === "app" ? container : null
      },
      addEventListener(type: string, handler: (event: { target?: unknown }) => void) {
        const existing = listeners.get(type) ?? []
        existing.push(handler)
        listeners.set(type, existing)
      },
    }
    ;(globalThis as Record<string, unknown>).window = {
      addEventListener() {},
      scrollY: 0,
      scrollTo() {},
    }
    ;(globalThis as Record<string, unknown>).history = {
      state: null,
      replaceState() {},
    }
    ;(globalThis as Record<string, unknown>).location = {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    }

    try {
      initRouter()
      listeners.get("focusin")?.[0]?.({ target: preservedInput })

      const snapshot = captureNavigationSnapshot(container as unknown as Element)
      expect(snapshot.focusKey).toBe("draft")
      expect(snapshot.controls).toEqual([{ key: "draft", mode: "value", value: "kept" }])
    } finally {
      ;(globalThis as Record<string, unknown>).document = originalDocument
      ;(globalThis as Record<string, unknown>).window = originalWindow
      ;(globalThis as Record<string, unknown>).history = originalHistory
      ;(globalThis as Record<string, unknown>).location = originalLocation
    }
  })

  test("focus tracking ignores links and preserves the last form-control key", () => {
    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location

    const listeners = new Map<string, Array<(event: { target?: unknown }) => void>>()
    const preservedInput = {
      tagName: "INPUT",
      getAttribute(name: string) {
        return name === "data-g-preserve-key" ? "draft" : null
      },
      name: "draft",
      id: "draft-home",
      value: "kept",
      checked: false,
    }
    const activeLink = {
      tagName: "A",
      getAttribute() { return null },
      name: "",
      id: "about-link",
    }
    const container = {
      contains(node: unknown) {
        return node === preservedInput || node === activeLink
      },
      querySelectorAll() {
        return [preservedInput]
      },
    }

    ;(globalThis as Record<string, unknown>).document = {
      activeElement: activeLink,
      getElementById(id: string) {
        return id === "app" ? container : null
      },
      addEventListener(type: string, handler: (event: { target?: unknown }) => void) {
        const existing = listeners.get(type) ?? []
        existing.push(handler)
        listeners.set(type, existing)
      },
    }
    ;(globalThis as Record<string, unknown>).window = {
      addEventListener() {},
      scrollY: 0,
      scrollTo() {},
    }
    ;(globalThis as Record<string, unknown>).history = {
      state: null,
      replaceState() {},
    }
    ;(globalThis as Record<string, unknown>).location = {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    }

    try {
      initRouter()
      listeners.get("focusin")?.[0]?.({ target: preservedInput })
      listeners.get("focusin")?.[0]?.({ target: activeLink })

      const snapshot = captureNavigationSnapshot(container as unknown as Element)
      expect(snapshot.focusKey).toBe("draft")
      expect(snapshot.controls).toEqual([{ key: "draft", mode: "value", value: "kept" }])
    } finally {
      ;(globalThis as Record<string, unknown>).document = originalDocument
      ;(globalThis as Record<string, unknown>).window = originalWindow
      ;(globalThis as Record<string, unknown>).history = originalHistory
      ;(globalThis as Record<string, unknown>).location = originalLocation
    }
  })

  test("initRouter does not register duplicate global listeners on repeated initialization", () => {
    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location
    const documentListeners: string[] = []
    const windowListeners: string[] = []

    ;(globalThis as Record<string, unknown>).document = {
      getElementById() {
        return null
      },
      querySelectorAll() {
        return []
      },
      addEventListener(type: string) {
        documentListeners.push(type)
      },
    }
    ;(globalThis as Record<string, unknown>).window = {
      addEventListener(type: string) {
        windowListeners.push(type)
      },
      scrollY: 0,
      scrollTo() {},
    }
    ;(globalThis as Record<string, unknown>).history = {
      state: null,
      replaceState() {},
    }
    ;(globalThis as Record<string, unknown>).location = {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    }

    try {
      initRouter()
      initRouter()

      expect(documentListeners).toEqual(["click", "focusin"])
      expect(windowListeners).toEqual(["popstate"])
    } finally {
      ;(globalThis as Record<string, unknown>).document = originalDocument
      ;(globalThis as Record<string, unknown>).window = originalWindow
      ;(globalThis as Record<string, unknown>).history = originalHistory
      ;(globalThis as Record<string, unknown>).location = originalLocation
    }
  })

  test("restore falls back to the first preserved control when focusKey is absent", () => {
    let focused = false
    const restoredInput = {
      value: "",
      focus() {
        focused = true
      },
    }

    const restoredContainer = {
      querySelector(selector: string) {
        if (selector.includes("draft")) return restoredInput
        return null
      },
    }

    restoreNavigationSnapshot(restoredContainer as unknown as Element, {
      controls: [{ key: "draft", mode: "value", value: "kept" }],
    })

    expect(restoredInput.value).toBe("kept")
    expect(focused).toBe(true)
  })

  test("initRouter only observes viewport-prefetch links and does not install global hover prefetch", () => {
    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location
    const originalIntersectionObserver = globalThis.IntersectionObserver

    const listeners = new Map<string, Array<(event: { target?: unknown; state?: Record<string, unknown> }) => void>>()
    const observed: unknown[] = []
    const viewportAnchor = {
      pathname: "/visible",
      search: "?tab=1",
      href: "/visible?tab=1",
      dataset: { gPrefetch: "viewport" },
    }

    class FakeIntersectionObserver {
      observe(target: unknown) {
        observed.push(target)
      }
      unobserve() {}
      disconnect() {}
    }

    ;(globalThis as Record<string, unknown>).IntersectionObserver = FakeIntersectionObserver
    ;(globalThis as Record<string, unknown>).document = {
      activeElement: null,
      getElementById() {
        return null
      },
      querySelectorAll(selector: string) {
        expect(selector).toBe('a[data-g-prefetch="viewport"][href]')
        return [viewportAnchor]
      },
      addEventListener(type: string, handler: (event: { target?: unknown; state?: Record<string, unknown> }) => void) {
        const existing = listeners.get(type) ?? []
        existing.push(handler)
        listeners.set(type, existing)
      },
    }
    ;(globalThis as Record<string, unknown>).window = {
      addEventListener(type: string, handler: (event: { target?: unknown; state?: Record<string, unknown> }) => void) {
        const existing = listeners.get(type) ?? []
        existing.push(handler)
        listeners.set(type, existing)
      },
      scrollY: 0,
      scrollTo() {},
    }
    ;(globalThis as Record<string, unknown>).history = {
      state: null,
      replaceState() {},
    }
    ;(globalThis as Record<string, unknown>).location = {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    }

    try {
      initRouter()
      expect(observed).toEqual([viewportAnchor])
      expect(listeners.has("mouseover")).toBe(false)
      expect(listeners.has("click")).toBe(true)
      expect(listeners.has("focusin")).toBe(true)
      expect(listeners.has("popstate")).toBe(true)
    } finally {
      ;(globalThis as Record<string, unknown>).document = originalDocument
      ;(globalThis as Record<string, unknown>).window = originalWindow
      ;(globalThis as Record<string, unknown>).history = originalHistory
      ;(globalThis as Record<string, unknown>).location = originalLocation
      ;(globalThis as Record<string, unknown>).IntersectionObserver = originalIntersectionObserver
    }
  })
})
