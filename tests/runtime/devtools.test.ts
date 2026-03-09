import { describe, expect, test } from "bun:test"
import { createSignal, createEffect } from "../../src/reactive/index.ts"
import { configureReactiveDiagnostics, resetReactiveDiagnostics } from "../../src/reactive/diagnostics.ts"
import { createRuntimeDevtoolsSnapshot, renderRuntimeDevtoolsHTML, renderRuntimeDevtoolsOverlay } from "../../src/runtime/devtools.ts"
import { enterHydration, exitHydration, resetHydrationDiagnostics } from "../../src/runtime/hydration.ts"

function elementNode(tagName: string) {
  return { nodeType: 1, tagName, childNodes: [] as unknown[] }
}

describe("runtime devtools", () => {
  test("builds a runtime snapshot from router, hydration, and reactive diagnostics", () => {
    resetReactiveDiagnostics()
    resetHydrationDiagnostics()
    configureReactiveDiagnostics({ enabled: true, captureEvents: true })

    const [count, setCount] = createSignal(1, { label: "count" })
    const stop = createEffect(() => {
      count()
    }, { label: "collector" })
    setCount(2)
    stop()

    const root = { childNodes: [elementNode("span")] }
    enterHydration(root as unknown as Element)
    exitHydration()

    const snapshot = createRuntimeDevtoolsSnapshot({
      routes: [
        { path: "/", methods: ["GET"], isApi: false, hasLoader: true, hasMiddleware: false, title: "Home" },
        { path: "/api/health", methods: ["GET"], isApi: true, hasLoader: false, hasMiddleware: true },
      ],
      includeTrace: true,
      maxReactiveEvents: 5,
      maxTopNodes: 3,
    })

    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.reactiveTraceSchemaVersion).toBe(1)
    expect(snapshot.hydration.recoverableMismatch).toBe(true)
    expect(snapshot.reactive.snapshot.signalsCreated).toBe(1)
    expect(snapshot.reactive.topNodes.length).toBeGreaterThan(0)
    expect(snapshot.reactive.recentEvents.length).toBeGreaterThan(0)
    expect(snapshot.routes?.summary).toEqual({
      total: 2,
      pages: 1,
      apis: 1,
      loaders: 1,
      middleware: 1,
    })
    expect(snapshot.summary.topReactiveNode).toBeTruthy()
    expect(snapshot.reactive.trace?.events.length).toBeGreaterThan(0)
  })

  test("renders HTML and full overlay documents", () => {
    const snapshot = createRuntimeDevtoolsSnapshot({
      routes: [
        { path: "/reports", methods: ["GET"], isApi: false, hasLoader: true, hasMiddleware: false },
      ],
    })

    const html = renderRuntimeDevtoolsHTML(snapshot)
    const overlay = renderRuntimeDevtoolsOverlay(snapshot, "nonce-123")

    expect(html).toContain("Gorsee Runtime Inspector")
    expect(html).toContain("Top Reactive Nodes")
    expect(html).toContain("Route Tree")
    expect(overlay).toContain("<!DOCTYPE html>")
    expect(overlay).toContain("nonce-123")
  })
})
