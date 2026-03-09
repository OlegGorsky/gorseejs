import { afterEach, describe, expect, test } from "bun:test"
import { applyHMRUpdate, initRouter } from "../../src/runtime/router.ts"

const originalDocument = globalThis.document
const originalWindow = globalThis.window
const originalHistory = globalThis.history
const originalLocation = globalThis.location
const originalFetch = globalThis.fetch

afterEach(() => {
  ;(globalThis as Record<string, unknown>).document = originalDocument
  ;(globalThis as Record<string, unknown>).window = originalWindow
  ;(globalThis as Record<string, unknown>).history = originalHistory
  ;(globalThis as Record<string, unknown>).location = originalLocation
  globalThis.fetch = originalFetch
  delete (globalThis as Record<string, unknown>).__GORSEE_ROUTE_SCRIPT__
  delete (globalThis as Record<string, unknown>).__gorseeHandleHMR
})

describe("router dev HMR runtime", () => {
  test("route-refresh re-fetches the current route without pushing history", async () => {
    const htmlWrites: string[] = []
    const historyWrites: string[] = []

    const container = {
      replaceChildren(...nodes: Array<{ html?: string }>) {
        htmlWrites.push(nodes.map((node) => node.html ?? "").join(""))
      },
      contains() { return false },
      querySelectorAll() { return [] },
      querySelector() { return null },
    }

    ;(globalThis as Record<string, unknown>).document = {
      title: "",
      activeElement: null,
      head: { appendChild() {} },
      body: { appendChild() {} },
      addEventListener() {},
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
    }

    ;(globalThis as Record<string, unknown>).window = {
      scrollTo() {},
      addEventListener() {},
    }
    ;(globalThis as Record<string, unknown>).history = {
      state: {},
      pushState(_state: unknown, _title: string, url: string) {
        historyWrites.push(url)
      },
      replaceState() {},
    }
    ;(globalThis as Record<string, unknown>).location = {
      pathname: "/",
      search: "",
      origin: "http://localhost",
      reload() {
        throw new Error("unexpected full reload")
      },
    }
    ;(globalThis as Record<string, unknown>).__GORSEE_ROUTE_SCRIPT__ = "/_gorsee/index.js"

    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
      html: "<div>fresh route</div>",
      data: { ok: true },
      params: {},
      title: "Fresh",
    })))) as unknown as typeof fetch

    initRouter()
    await applyHMRUpdate({
      kind: "route-refresh",
      changedPath: "/repo/routes/index.tsx",
      timestamp: 1,
      entryScripts: ["/_gorsee/index.js"],
    })

    expect(htmlWrites).toEqual(["<div>fresh route</div>"])
    expect(historyWrites).toEqual([])
    expect((globalThis as Record<string, unknown>).__GORSEE_ROUTE_SCRIPT__).toBe("/_gorsee/index.js")
  })

  test("css-update busts local stylesheet URLs without forcing a reload", async () => {
    const stylesheets = [
      { href: "http://localhost/styles.css" },
      { href: "http://localhost/app.css?theme=light" },
      { href: "https://cdn.example.com/remote.css" },
    ]

    ;(globalThis as Record<string, unknown>).document = {
      addEventListener() {},
      querySelectorAll(selector: string) {
        if (selector === 'link[rel="stylesheet"]') return stylesheets
        return []
      },
    }
    ;(globalThis as Record<string, unknown>).window = {
      addEventListener() {},
    }
    ;(globalThis as Record<string, unknown>).history = {
      state: {},
      replaceState() {},
    }
    ;(globalThis as Record<string, unknown>).location = {
      pathname: "/",
      search: "",
      origin: "http://localhost",
      reload() {
        throw new Error("unexpected full reload")
      },
    }

    initRouter()
    await applyHMRUpdate({
      kind: "css-update",
      changedPath: "/repo/shared/theme.css",
      timestamp: 42,
      refreshCurrentRoute: false,
    })

    expect(stylesheets[0]!.href).toContain("gorsee-hmr=42")
    expect(stylesheets[1]!.href).toContain("gorsee-hmr=42")
    expect(stylesheets[2]!.href).toBe("https://cdn.example.com/remote.css")
  })
})
