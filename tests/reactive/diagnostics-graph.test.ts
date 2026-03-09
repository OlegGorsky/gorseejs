import { describe, expect, test } from "bun:test"
import {
  configureReactiveDiagnostics,
  createComputed,
  createEffect,
  createSignal,
  getReactiveDependencyEdges,
  getReactiveDiagnosticsEvents,
  getReactiveGraphNodes,
  getReactiveTraceArtifact,
  resetReactiveDiagnostics,
} from "../../src/reactive/index.ts"

describe("reactive graph diagnostics", () => {
  test("captures labeled graph nodes and ordered events", () => {
    resetReactiveDiagnostics()
    configureReactiveDiagnostics({ enabled: true, captureEvents: true, maxEvents: 20 })

    const [count, setCount] = createSignal(1, { label: "count" })
    const doubled = createComputed(() => count() * 2, { label: "doubled" })
    const seen: number[] = []
    const stop = createEffect(() => {
      seen.push(doubled())
    }, { label: "collector" })

    setCount(2)
    stop()

    const nodes = getReactiveGraphNodes()
    const edges = getReactiveDependencyEdges()
    const events = getReactiveDiagnosticsEvents()
    const trace = getReactiveTraceArtifact()

    expect(nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "signal", label: "count", writes: 1 }),
      expect.objectContaining({ kind: "computed", label: "doubled", reads: expect.any(Number), runs: expect.any(Number) }),
      expect.objectContaining({ kind: "effect", label: "collector", runs: expect.any(Number) }),
    ]))
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceLabel: "count", targetLabel: "doubled" }),
      expect.objectContaining({ sourceLabel: "doubled", targetLabel: "collector" }),
    ]))
    expect(events[0]).toEqual(expect.objectContaining({ kind: "signal:create", label: "count" }))
    expect(events.some((event) => event.kind === "invalidation" && event.relatedLabel === "count")).toBe(true)
    expect(events.some((event) => event.kind === "effect:run" && event.label === "collector")).toBe(true)
    expect(trace.edges).toHaveLength(edges.length)
    expect(trace.nodes).toHaveLength(nodes.length)
    expect(seen).toEqual([2, 4])
  })

  test("caps diagnostic event history", () => {
    resetReactiveDiagnostics()
    configureReactiveDiagnostics({ enabled: true, captureEvents: true, maxEvents: 3 })

    const [value, setValue] = createSignal(0, { label: "value" })
    value()
    setValue(1)
    value()
    setValue(2)

    const events = getReactiveDiagnosticsEvents()
    expect(events).toHaveLength(3)
    expect(events[0]?.seq).toBeGreaterThan(1)
  })
})
