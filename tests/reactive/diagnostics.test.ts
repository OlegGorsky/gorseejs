import { describe, expect, test } from "bun:test"
import {
  configureReactiveDiagnostics,
  createComputed,
  createEffect,
  createMutation,
  createResource,
  createSignal,
  getReactiveDiagnosticsEvents,
  getReactiveDiagnosticsSnapshot,
  getReactiveTraceArtifact,
  invalidateAll,
  invalidateResource,
  resetReactiveDiagnostics,
} from "../../src/reactive/index.ts"

describe("reactive diagnostics", () => {
  test("tracks signal, computed, and effect activity when enabled", () => {
    resetReactiveDiagnostics()
    configureReactiveDiagnostics({ enabled: true })

    const [count, setCount] = createSignal(1)
    const doubled = createComputed(() => count() * 2)
    const values: number[] = []

    const stop = createEffect(() => {
      values.push(doubled())
    })

    setCount(2)
    stop()

    const snapshot = getReactiveDiagnosticsSnapshot()
    expect(snapshot.signalsCreated).toBe(1)
    expect(snapshot.signalReads).toBeGreaterThan(0)
    expect(snapshot.signalWrites).toBe(1)
    expect(snapshot.computedCreated).toBe(1)
    expect(snapshot.computedReads).toBeGreaterThan(0)
    expect(snapshot.computedRuns).toBeGreaterThan(0)
    expect(snapshot.effectCreated).toBe(1)
    expect(snapshot.effectRuns).toBeGreaterThan(0)
    expect(values).toEqual([2, 4])
  })

  test("tracks resource and mutation lifecycle in machine-readable traces", async () => {
    resetReactiveDiagnostics()
    configureReactiveDiagnostics({ enabled: true, captureEvents: true })

    let fetchCount = 0
    const [user, userState] = createResource(async () => {
      fetchCount++
      if (fetchCount === 1) return { name: "Ada" }
      throw new Error("network")
    }, { key: "user:1", label: "user-resource" })

    await Bun.sleep(0)
    userState.mutate({ name: "Grace" })
    invalidateResource("user:1")
    userState.refetch()

    const mutation = createMutation<string, string>({
      label: "save-user",
      mutationFn: async (name) => {
        if (name === "bad") throw new Error("save failed")
        return name.toUpperCase()
      },
    })

    await mutation.mutate("ada")
    await expect(mutation.optimistic(
      user,
      (value) => { if (value !== undefined) userState.mutate(value) },
      (current, next) => ({ ...(current ?? { name: "" }), name: next }),
      "bad",
    )).rejects.toThrow("save failed")
    mutation.reset()
    await Bun.sleep(0)

    const snapshot = getReactiveDiagnosticsSnapshot()
    const events = getReactiveDiagnosticsEvents()
    const trace = getReactiveTraceArtifact()

    expect(snapshot.resourcesCreated).toBe(1)
    expect(snapshot.resourceLoadsStarted).toBeGreaterThanOrEqual(2)
    expect(snapshot.resourceLoadsSucceeded).toBeGreaterThanOrEqual(1)
    expect(snapshot.resourceLoadsFailed).toBeGreaterThanOrEqual(1)
    expect(snapshot.resourceInvalidations).toBe(1)
    expect(snapshot.resourceMutations).toBeGreaterThanOrEqual(2)
    expect(snapshot.mutationsCreated).toBe(1)
    expect(snapshot.mutationRuns).toBe(2)
    expect(snapshot.mutationSuccesses).toBe(1)
    expect(snapshot.mutationFailures).toBe(1)
    expect(snapshot.mutationRollbacks).toBe(1)
    expect(snapshot.mutationResets).toBe(1)
    expect(events.some((event) => event.kind === "resource:load.start" && event.cacheKey === "user:1")).toBe(true)
    expect(events.some((event) => event.kind === "resource:invalidate" && event.reason === "resource.invalidate")).toBe(true)
    expect(events.some((event) => event.kind === "mutation:rollback" && event.label === "save-user")).toBe(true)
    expect(trace.schemaVersion).toBe(1)
    expect(trace.events.length).toBeGreaterThan(0)
  })

  test("stays inert when disabled", () => {
    resetReactiveDiagnostics()
    configureReactiveDiagnostics({ enabled: false })

    const [count, setCount] = createSignal(0)
    const stop = createEffect(() => {
      count()
    })
    setCount(1)
    stop()

    expect(getReactiveDiagnosticsSnapshot()).toEqual({
      signalsCreated: 0,
      signalReads: 0,
      signalWrites: 0,
      computedCreated: 0,
      computedReads: 0,
      computedRuns: 0,
      effectCreated: 0,
      effectRuns: 0,
      resourcesCreated: 0,
      resourceLoadsStarted: 0,
      resourceLoadsSucceeded: 0,
      resourceLoadsFailed: 0,
      resourceInvalidations: 0,
      resourceMutations: 0,
      mutationsCreated: 0,
      mutationRuns: 0,
      mutationSuccesses: 0,
      mutationFailures: 0,
      mutationRollbacks: 0,
      mutationResets: 0,
    })
    invalidateAll()
  })
})
