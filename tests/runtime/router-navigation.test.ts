import { afterEach, describe, expect, test } from "bun:test"
import { beforeNavigate, getCurrentPath, getRouterNavigationDiagnostics, initRouter, navigate } from "../../src/runtime/router.ts"

const originalDocument = globalThis.document
const originalWindow = globalThis.window
const originalHistory = globalThis.history
const originalLocation = globalThis.location
const originalFetch = globalThis.fetch

function setGlobalValue(key: "document" | "window" | "history" | "location", value: unknown): void {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

afterEach(() => {
  setGlobalValue("document", originalDocument)
  setGlobalValue("window", originalWindow)
  setGlobalValue("history", originalHistory)
  setGlobalValue("location", originalLocation)
  globalThis.fetch = originalFetch
})

describe("router navigation semantics", () => {
  test("newer navigation aborts an older in-flight navigation", async () => {
    const htmlWrites: string[] = []
    const historyWrites: string[] = []
    const scrollWrites: Array<[number, number]> = []
    const removedCss: string[] = []
    const dataScript = {
      textContent: "",
      remove() {
        this.textContent = ""
      },
    }

    const container = {
      replaceChildren(...nodes: Array<{ html?: string }>) {
        htmlWrites.push(nodes.map((node) => node.html ?? "").join(""))
      },
    }

    setGlobalValue("document", {
      title: "",
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement(tag: string) {
        if (tag === "template") {
          return {
            content: { childNodes: [] as Array<{ html: string }> },
            set innerHTML(html: string) {
              this.content.childNodes = [{ html }]
            },
          }
        }

        return {
          dataset: {} as Record<string, string>,
          setAttribute() {},
        }
      },
      getElementById(id: string) {
        if (id === "app") return container
        if (id === "__GORSEE_DATA__") return dataScript
        return null
      },
      querySelectorAll() {
        return [
          {
            remove() {
              removedCss.push("removed")
            },
          },
        ]
      },
    })

    setGlobalValue("window", {
      scrollTo(x: number, y: number) {
        scrollWrites.push([x, y])
      },
    })
    setGlobalValue("history", {
      pushState(_state: unknown, _title: string, url: string) {
        historyWrites.push(url)
      },
    })
    setGlobalValue("location", {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    })

    let aborts = 0
    let resolveFirst: ((value: Response) => void) | undefined

    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      if (href === "/slow") {
        init?.signal?.addEventListener("abort", () => {
          aborts++
        })
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve
        })
      }

      return Promise.resolve(new Response(JSON.stringify({
        html: "<div>fast</div>",
        data: { ok: true },
        params: {},
        title: "Fast",
      })))
    }) as typeof fetch

    const slowNavigation = navigate("/slow")
    await Promise.resolve()
    const fastNavigation = navigate("/fast")
    resolveFirst?.(new Response(JSON.stringify({
      html: "<div>slow</div>",
      data: { ok: false },
      params: {},
      title: "Slow",
    })))

    await Promise.all([slowNavigation, fastNavigation])

    expect(aborts).toBe(1)
    expect(htmlWrites).toEqual(["<div>fast</div>"])
    expect(historyWrites).toEqual(["/fast"])
    expect(scrollWrites).toEqual([[0, 0]])
    expect(removedCss.length).toBe(1)
  })

  test("A -> B -> C races keep only the latest navigation result", async () => {
    const htmlWrites: string[] = []
    const historyWrites: string[] = []
    const abortedUrls: string[] = []

    const container = {
      replaceChildren(...nodes: Array<{ html?: string }>) {
        htmlWrites.push(nodes.map((node) => node.html ?? "").join(""))
      },
      contains() { return false },
      querySelectorAll() { return [] },
      querySelector() { return null },
    }

    setGlobalValue("document", {
      title: "",
      activeElement: null,
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement(tag: string) {
        if (tag === "template") {
          return {
            content: { childNodes: [] as Array<{ html: string }> },
            set innerHTML(html: string) {
              this.content.childNodes = [{ html }]
            },
          }
        }

        return {
          dataset: {} as Record<string, string>,
          setAttribute() {},
        }
      },
      getElementById(id: string) {
        if (id === "app") return container
        return null
      },
      querySelectorAll() {
        return []
      },
    })

    setGlobalValue("window", {
      scrollTo() {},
    })
    setGlobalValue("history", {
      pushState(_state: unknown, _title: string, url: string) {
        historyWrites.push(url)
      },
    })
    setGlobalValue("location", {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    })

    const resolvers = new Map<string, (response: Response) => void>()
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      init?.signal?.addEventListener("abort", () => {
        abortedUrls.push(href)
      })
      return new Promise<Response>((resolve) => {
        resolvers.set(href, resolve)
      })
    }) as typeof fetch

    const navA = navigate("/a")
    await Promise.resolve()
    const navB = navigate("/b")
    await Promise.resolve()
    const navC = navigate("/c")

    resolvers.get("/b")?.(new Response(JSON.stringify({
      html: "<div>b</div>",
      data: {},
      params: {},
      title: "B",
    })))
    resolvers.get("/a")?.(new Response(JSON.stringify({
      html: "<div>a</div>",
      data: {},
      params: {},
      title: "A",
    })))
    resolvers.get("/c")?.(new Response(JSON.stringify({
      html: "<div>c</div>",
      data: {},
      params: {},
      title: "C",
    })))

    await Promise.all([navA, navB, navC])

    expect(abortedUrls).toEqual(["/a", "/b"])
    expect(htmlWrites).toEqual(["<div>c</div>"])
    expect(historyWrites).toEqual(["/c"])
    expect(getCurrentPath()).toBe("/c")
  })

  test("push navigation resets scroll and popstate restores the saved scroll position", async () => {
    const scrollWrites: Array<[number, number]> = []
    const popstateHandlers: Array<(event: { state?: Record<string, unknown> }) => void> = []
    const historyWrites: string[] = []
    const replaceStateWrites: Array<{ url: string; state: Record<string, unknown> }> = []

    const container = {
      replaceChildren() {},
      contains() { return false },
      querySelectorAll() { return [] },
      querySelector() { return null },
    }

    const dataScript = {
      textContent: "",
      remove() {
        this.textContent = ""
      },
    }

    setGlobalValue("document", {
      title: "",
      activeElement: null,
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement(tag: string) {
        if (tag === "template") {
          return {
            content: { childNodes: [] as Array<{ html: string }> },
            set innerHTML(html: string) {
              this.content.childNodes = [{ html }]
            },
          }
        }

        return {
          dataset: {} as Record<string, string>,
          setAttribute() {},
        }
      },
      addEventListener() {},
      getElementById(id: string) {
        if (id === "app") return container
        if (id === "__GORSEE_DATA__") return dataScript
        return null
      },
      querySelectorAll() {
        return []
      },
    })

    const windowState = {
      scrollY: 480,
      scrollTo(x: number, y: number) {
        windowState.scrollY = y
        scrollWrites.push([x, y])
      },
      addEventListener(type: string, handler: (event: { state?: Record<string, unknown> }) => void) {
        if (type === "popstate") popstateHandlers.push(handler)
      },
    }

    setGlobalValue("window", windowState)
    const historyState = {
      state: null as Record<string, unknown> | null,
      pushState(state: Record<string, unknown>, _title: string, url: string) {
        this.state = state
        historyWrites.push(url)
      },
      replaceState(state: Record<string, unknown>, _title: string, url: string) {
        this.state = state
        replaceStateWrites.push({ state, url })
      },
    }
    setGlobalValue("history", historyState)
    setGlobalValue("location", {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    })

    globalThis.fetch = ((() => Promise.resolve(new Response(JSON.stringify({
      html: "<div>ok</div>",
      data: { ok: true },
      params: {},
      title: "OK",
    })))) as unknown) as typeof fetch

    initRouter()
    await navigate("/about")

    expect(historyWrites).toEqual(["/about"])
    expect(scrollWrites.at(-1)).toEqual([0, 0])
    expect(replaceStateWrites.at(-1)?.state.gorseeScrollY).toBe(480)

    setGlobalValue("location", {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    })
    windowState.scrollY = 0
    popstateHandlers[0]?.({ state: { gorsee: true, gorseeScrollY: 480 } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(scrollWrites.at(-1)).toEqual([0, 480])
  })

  test("router keeps query-aware currentPath and popstate navigation semantics", async () => {
    const popstateHandlers: Array<(event: { state?: Record<string, unknown> }) => void> = []
    const historyWrites: string[] = []

    const container = {
      replaceChildren() {},
      contains() { return false },
      querySelectorAll() { return [] },
      querySelector() { return null },
    }

    setGlobalValue("document", {
      title: "",
      activeElement: null,
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement(tag: string) {
        if (tag === "template") {
          return {
            content: { childNodes: [] as Array<{ html: string }> },
            set innerHTML(html: string) {
              this.content.childNodes = [{ html }]
            },
          }
        }

        return {
          dataset: {} as Record<string, string>,
          setAttribute() {},
        }
      },
      addEventListener() {},
      getElementById(id: string) {
        if (id === "app") return container
        return null
      },
      querySelectorAll() {
        return []
      },
    })

    setGlobalValue("window", {
      scrollY: 0,
      scrollTo() {},
      addEventListener(type: string, handler: (event: { state?: Record<string, unknown> }) => void) {
        if (type === "popstate") popstateHandlers.push(handler)
      },
    })
    setGlobalValue("history", {
      state: null,
      pushState(_state: unknown, _title: string, url: string) {
        historyWrites.push(url)
      },
      replaceState() {},
    })
    setGlobalValue("location", {
      pathname: "/search",
      search: "?page=1",
      origin: "http://localhost",
    })

    globalThis.fetch = ((url: string | URL | Request) => Promise.resolve(new Response(JSON.stringify({
      html: `<div>${String(url)}</div>`,
      data: {},
      params: {},
      title: "Search",
    })))) as typeof fetch

    initRouter()
    expect(getCurrentPath()).toBe("/search?page=1")

    await navigate("/search?page=2")
    expect(historyWrites).toEqual(["/search?page=2"])
    expect(getCurrentPath()).toBe("/search?page=2")

    setGlobalValue("location", {
      pathname: "/search",
      search: "?page=1",
      origin: "http://localhost",
    })
    popstateHandlers[0]?.({ state: { gorsee: true, gorseeScrollY: 0 } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getCurrentPath()).toBe("/search?page=1")
  })

  test("beforeNavigate hook failures cancel navigation fail-closed and diagnostics expose active navigation state", async () => {
    const container = {
      replaceChildren() {},
      contains() { return false },
      querySelectorAll() { return [] },
      querySelector() { return null },
    }
    const loadingElement = {
      style: { display: "none" },
      removeAttribute() {},
    }

    setGlobalValue("document", {
      title: "",
      activeElement: null,
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement(tag: string) {
        if (tag === "template") {
          return {
            content: { childNodes: [] as Array<{ html: string }> },
            set innerHTML(html: string) {
              this.content.childNodes = [{ html }]
            },
          }
        }

        return {
          dataset: {} as Record<string, string>,
          setAttribute() {},
        }
      },
      addEventListener() {},
      getElementById(id: string) {
        if (id === "app") return container
        return null
      },
      querySelectorAll() {
        return []
      },
    })
    setGlobalValue("window", {
      scrollY: 0,
      scrollTo() {},
      addEventListener() {},
    })
    setGlobalValue("history", {
      state: null,
      pushState() {},
      replaceState() {},
    })
    setGlobalValue("location", {
      pathname: "/",
      search: "",
      origin: "http://localhost",
    })

    let fetchCalls = 0
    globalThis.fetch = ((() => {
      fetchCalls++
      return Promise.resolve(new Response(JSON.stringify({
        html: "<div>ok</div>",
        data: {},
        params: {},
        title: "OK",
      })))
    }) as unknown) as typeof fetch

    const unsubscribe = beforeNavigate(() => {
      throw new Error("hook failed")
    })

    const diagnosticsBefore = getRouterNavigationDiagnostics()
    expect(diagnosticsBefore.activeNavigation).toBeNull()

    await navigate("/blocked")

    const diagnosticsAfter = getRouterNavigationDiagnostics()
    expect(fetchCalls).toBe(0)
    expect(diagnosticsAfter.navigating).toBe(false)
    expect(diagnosticsAfter.activeNavigation).toBeNull()

    unsubscribe()
    let resolveNavigation: ((response: Response) => void) | undefined
    globalThis.fetch = ((() => new Promise<Response>((resolve) => {
      fetchCalls++
      resolveNavigation = resolve
    })) as unknown) as typeof fetch

    const inFlight = navigate("/allowed")
    await Promise.resolve()

    const diagnosticsDuring = getRouterNavigationDiagnostics()
    expect(diagnosticsDuring.navigating).toBe(true)
    expect(diagnosticsDuring.activeNavigation).toEqual({
      url: "/allowed",
      pushState: true,
    })

    resolveNavigation?.(new Response(JSON.stringify({
      html: "<div>ok</div>",
      data: {},
      params: {},
      title: "OK",
    })))
    await inFlight

    expect(getRouterNavigationDiagnostics().activeNavigation).toBeNull()
    void loadingElement
  })

  test("initRouter does not treat same-path links with changed query and hash as hash-only navigation", async () => {
    const listeners = new Map<string, Array<(event: { target?: unknown; preventDefault(): void }) => void>>()
    const historyWrites: string[] = []
    const prevented: boolean[] = []

    const anchor = {
      pathname: "/search",
      search: "?page=2",
      hash: "#results",
      origin: "http://localhost",
      target: "",
      dataset: {},
      hasAttribute() {
        return false
      },
    }
    const event = {
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      button: 0,
      target: {
        closest(selector: string) {
          expect(selector).toBe("a[href]")
          return anchor
        },
      },
      preventDefault() {
        prevented.push(true)
      },
    }

    const container = {
      replaceChildren() {},
      contains() { return false },
      querySelectorAll() { return [] },
      querySelector() { return null },
    }

    setGlobalValue("document", {
      title: "",
      activeElement: null,
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement(tag: string) {
        if (tag === "template") {
          return {
            content: { childNodes: [] as Array<{ html: string }> },
            set innerHTML(html: string) {
              this.content.childNodes = [{ html }]
            },
          }
        }

        return {
          dataset: {} as Record<string, string>,
          setAttribute() {},
        }
      },
      addEventListener(type: string, handler: (event: { target?: unknown; preventDefault(): void }) => void) {
        const existing = listeners.get(type) ?? []
        existing.push(handler)
        listeners.set(type, existing)
      },
      getElementById(id: string) {
        if (id === "app") return container
        return null
      },
      querySelectorAll() {
        return []
      },
    })
    setGlobalValue("window", {
      scrollY: 0,
      scrollTo() {},
      addEventListener() {},
    })
    setGlobalValue("history", {
      state: null,
      pushState(_state: unknown, _title: string, url: string) {
        historyWrites.push(url)
      },
      replaceState() {},
    })
    setGlobalValue("location", {
      pathname: "/search",
      search: "?page=1",
      origin: "http://localhost",
    })

    globalThis.fetch = ((url: string | URL | Request) => Promise.resolve(new Response(JSON.stringify({
      html: `<div>${String(url)}</div>`,
      data: {},
      params: {},
      title: "Search",
    })))) as typeof fetch

    initRouter()
    listeners.get("click")?.[0]?.(event)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(prevented).toEqual([true])
    expect(historyWrites).toEqual(["/search?page=2"])
    expect(getCurrentPath()).toBe("/search?page=2")
  })
})
