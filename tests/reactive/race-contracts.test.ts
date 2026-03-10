import { afterEach, describe, expect, test } from "bun:test"
import { createLive } from "../../src/reactive/live.ts"
import { createMutation } from "../../src/reactive/optimistic.ts"
import { createResource, invalidateAll, invalidateResource } from "../../src/reactive/resource.ts"
import { createSignal } from "../../src/reactive/signal.ts"

const originalWebSocket = globalThis.WebSocket
const originalSetTimeout = globalThis.setTimeout

afterEach(() => {
  invalidateAll()
  ;(globalThis as Record<string, unknown>).WebSocket = originalWebSocket
  globalThis.setTimeout = originalSetTimeout
})

describe("reactive race contracts", () => {
  test("createResource ignores stale refetch results from older in-flight loads", async () => {
    let resolveFirst!: (value: string) => void
    let resolveSecond!: (value: string) => void
    let callCount = 0

    const [data, state] = createResource(async () => {
      callCount += 1
      if (callCount === 1) {
        return await new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      }
      return await new Promise<string>((resolve) => {
        resolveSecond = resolve
      })
    })

    state.refetch()
    resolveSecond("fresh")
    await Promise.resolve()
    await Promise.resolve()
    resolveFirst("stale")
    await Promise.resolve()
    await Promise.resolve()

    expect(data()).toBe("fresh")
    expect(state.loading()).toBe(false)
    expect(state.error()).toBeUndefined()
  })

  test("createResource shares cached promise across colliding keys without double fetch", async () => {
    let resolver!: (value: string) => void
    let fetchCalls = 0

    const fetcher = async () => {
      fetchCalls += 1
      return await new Promise<string>((resolve) => {
        resolver = resolve
      })
    }

    const [first] = createResource(fetcher, { key: "shared-key" })
    const [second] = createResource(fetcher, { key: "shared-key" })

    expect(fetchCalls).toBe(1)
    resolver("shared-value")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(first()).toBe("shared-value")
    expect(second()).toBe("shared-value")
  })

  test("invalidateResource during an in-flight load prevents stale cache repopulation", async () => {
    let resolveFirst!: (value: string) => void
    let resolveSecond!: (value: string) => void
    let calls = 0

    const fetcher = async () => {
      calls += 1
      if (calls === 1) {
        return await new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      }
      return await new Promise<string>((resolve) => {
        resolveSecond = resolve
      })
    }

    createResource(fetcher, { key: "invalidate-key" })
    invalidateResource("invalidate-key")
    const [nextData] = createResource(fetcher, { key: "invalidate-key" })

    resolveFirst("stale-first")
    resolveSecond("fresh-second")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(nextData()).toBe("fresh-second")
  })

  test("invalidateResource during a deduped in-flight load does not leave resources stuck loading", async () => {
    let resolveFetch!: (value: string) => void

    const fetcher = async () => {
      return await new Promise<string>((resolve) => {
        resolveFetch = resolve
      })
    }

    const [, firstState] = createResource(fetcher, { key: "invalidate-dedup-loading" })
    const [, secondState] = createResource(fetcher, { key: "invalidate-dedup-loading" })

    expect(firstState.loading()).toBe(true)
    expect(secondState.loading()).toBe(true)

    invalidateResource("invalidate-dedup-loading")
    resolveFetch("stale-value")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(firstState.loading()).toBe(false)
    expect(secondState.loading()).toBe(false)
    expect(firstState.error()).toBeUndefined()
    expect(secondState.error()).toBeUndefined()
  })

  test("invalidateAll during in-flight loads prevents stale repopulation across multiple keys", async () => {
    let resolveUser!: (value: string) => void
    let resolvePosts!: (value: string) => void

    const [userData] = createResource(async () => {
      return await new Promise<string>((resolve) => {
        resolveUser = resolve
      })
    }, { key: "user:1" })
    const [postsData] = createResource(async () => {
      return await new Promise<string>((resolve) => {
        resolvePosts = resolve
      })
    }, { key: "posts:list" })

    invalidateAll()

    const [freshUser] = createResource(async () => "fresh-user", { key: "user:1" })
    const [freshPosts] = createResource(async () => "fresh-posts", { key: "posts:list" })

    resolveUser("stale-user")
    resolvePosts("stale-posts")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(userData()).toBeUndefined()
    expect(postsData()).toBeUndefined()
    expect(freshUser()).toBe("fresh-user")
    expect(freshPosts()).toBe("fresh-posts")
  })

  test("resource mutate suppresses stale in-flight fetch completion from overwriting local state", async () => {
    let resolveFetch!: (value: string) => void

    const [data, state] = createResource(async () => {
      return await new Promise<string>((resolve) => {
        resolveFetch = resolve
      })
    }, { key: "mutate-race" })

    state.mutate("local-value")
    expect(data()).toBe("local-value")

    resolveFetch("stale-server-value")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(data()).toBe("local-value")
    expect(state.error()).toBeUndefined()
    expect(state.loading()).toBe(false)
  })

  test("refetch on one shared-key resource suppresses stale in-flight completion for peer resources", async () => {
    let resolveFirst!: (value: string) => void
    let resolveSecond!: (value: string) => void
    let calls = 0

    const fetcher = async () => {
      calls += 1
      if (calls === 1) {
        return await new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      }
      return await new Promise<string>((resolve) => {
        resolveSecond = resolve
      })
    }

    const [firstData, firstState] = createResource(fetcher, { key: "shared-refetch-race" })
    const [secondData, secondState] = createResource(fetcher, { key: "shared-refetch-race" })

    secondState.refetch()
    resolveSecond("fresh-value")
    await new Promise((resolve) => setTimeout(resolve, 0))

    resolveFirst("stale-value")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(firstData()).toBeUndefined()
    expect(secondData()).toBe("fresh-value")
    expect(firstState.loading()).toBe(false)
    expect(secondState.loading()).toBe(false)
    expect(firstState.error()).toBeUndefined()
    expect(secondState.error()).toBeUndefined()
  })

  test("repeated mutate refetch invalidate churn keeps the newest shared-key state authoritative", async () => {
    let resolveInitial!: (value: string) => void
    let resolveRefetch!: (value: string) => void
    let resolveRecreated!: (value: string) => void
    let calls = 0

    const fetcher = async () => {
      calls += 1
      if (calls === 1) {
        return await new Promise<string>((resolve) => {
          resolveInitial = resolve
        })
      }
      if (calls === 2) {
        return await new Promise<string>((resolve) => {
          resolveRefetch = resolve
        })
      }
      return await new Promise<string>((resolve) => {
        resolveRecreated = resolve
      })
    }

    const [firstData, firstState] = createResource(fetcher, { key: "churn-key" })
    firstState.mutate("local-value")
    expect(firstData()).toBe("local-value")
    expect(firstState.loading()).toBe(false)

    firstState.refetch()
    expect(firstState.loading()).toBe(true)

    invalidateResource("churn-key")
    const [recreatedData, recreatedState] = createResource(fetcher, { key: "churn-key" })
    expect(recreatedState.loading()).toBe(true)

    resolveInitial("stale-initial")
    resolveRefetch("stale-refetch")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(firstData()).toBe("local-value")
    expect(firstState.loading()).toBe(false)
    expect(firstState.error()).toBeUndefined()
    expect(recreatedData()).toBeUndefined()
    expect(recreatedState.loading()).toBe(true)

    resolveRecreated("fresh-recreated")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(recreatedData()).toBe("fresh-recreated")
    expect(recreatedState.loading()).toBe(false)
    expect(recreatedState.error()).toBeUndefined()
  })

  test("multi-cycle shared-key churn preserves authoritative state across repeated loops", async () => {
    const pendingResolvers = new Map<number, (value: string) => void>()
    let calls = 0

    const fetcher = async () => {
      calls += 1
      const callId = calls
      return await new Promise<string>((resolve) => {
        pendingResolvers.set(callId, resolve)
      })
    }

    const [data, state] = createResource(fetcher, { key: "multi-cycle-key" })

    state.mutate("cycle-1-local")
    state.refetch()
    invalidateResource("multi-cycle-key")
    const [cycleOneData, cycleOneState] = createResource(fetcher, { key: "multi-cycle-key" })
    pendingResolvers.get(2)?.("cycle-1-stale-refetch")
    pendingResolvers.get(1)?.("cycle-1-stale-initial")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(data()).toBe("cycle-1-local")
    expect(cycleOneData()).toBeUndefined()
    expect(cycleOneState.loading()).toBe(true)
    pendingResolvers.get(3)?.("cycle-1-fresh")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cycleOneData()).toBe("cycle-1-fresh")
    expect(cycleOneState.loading()).toBe(false)

    cycleOneState.mutate("cycle-2-local")
    cycleOneState.refetch()
    invalidateResource("multi-cycle-key")
    const [cycleTwoData, cycleTwoState] = createResource(fetcher, { key: "multi-cycle-key" })
    pendingResolvers.get(4)?.("cycle-2-stale-refetch")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cycleOneData()).toBe("cycle-2-local")
    expect(cycleOneState.loading()).toBe(false)
    expect(cycleTwoData()).toBeUndefined()
    pendingResolvers.get(5)?.("cycle-2-fresh")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cycleTwoData()).toBe("cycle-2-fresh")
    expect(cycleTwoState.loading()).toBe(false)

    cycleTwoState.refetch()
    pendingResolvers.get(6)?.("cycle-3-fresh")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cycleTwoData()).toBe("cycle-3-fresh")
    expect(cycleTwoState.loading()).toBe(false)
    expect(cycleTwoState.error()).toBeUndefined()
  })

  test("seeded pseudo-random shared-key churn preserves authoritative state", async () => {
    const pendingResolvers = new Map<number, (value: string) => void>()
    let calls = 0
    let seed = 17

    const nextOp = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed % 4
    }

    const fetcher = async () => {
      calls += 1
      const callId = calls
      return await new Promise<string>((resolve) => {
        pendingResolvers.set(callId, resolve)
      })
    }

    const [data, state] = createResource(fetcher, { key: "seeded-churn-key" })
    let expectedValue: string | undefined
    let activeState = state
    let activeData = data

    for (let step = 0; step < 12; step += 1) {
      const op = nextOp()

      if (op === 0) {
        expectedValue = `local-${step}`
        activeState.mutate(expectedValue)
        expect(activeData()).toBe(expectedValue)
        expect(activeState.loading()).toBe(false)
      } else if (op === 1) {
        activeState.refetch()
        expect(activeState.loading()).toBe(true)
        const currentCall = calls
        pendingResolvers.get(currentCall)?.(`server-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expectedValue = `server-${step}`
        expect(activeData()).toBe(expectedValue)
        expect(activeState.loading()).toBe(false)
      } else if (op === 2) {
        invalidateResource("seeded-churn-key")
        const recreated = createResource(fetcher, { key: "seeded-churn-key" })
        activeData = recreated[0]
        activeState = recreated[1]
        expect(activeState.loading()).toBe(true)
        const currentCall = calls
        pendingResolvers.get(currentCall)?.(`recreated-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expectedValue = `recreated-${step}`
        expect(activeData()).toBe(expectedValue)
        expect(activeState.loading()).toBe(false)
      } else {
        activeState.refetch()
        const freshCall = calls
        invalidateResource("seeded-churn-key")
        const recreated = createResource(fetcher, { key: "seeded-churn-key" })
        activeData = recreated[0]
        activeState = recreated[1]
        pendingResolvers.get(freshCall)?.(`stale-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(activeState.loading()).toBe(true)
        const currentCall = calls
        pendingResolvers.get(currentCall)?.(`fresh-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expectedValue = `fresh-${step}`
        expect(activeData()).toBe(expectedValue)
        expect(activeState.loading()).toBe(false)
      }

      expect(activeState.error()).toBeUndefined()
      expect(activeData()).toBe(expectedValue)
    }
  })

  test("long deterministic shared-key soak preserves authoritative state across dozens of steps", async () => {
    const pendingResolvers = new Map<number, (value: string) => void>()
    let calls = 0
    let seed = 23

    const nextOp = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed % 4
    }

    const fetcher = async () => {
      calls += 1
      const callId = calls
      return await new Promise<string>((resolve) => {
        pendingResolvers.set(callId, resolve)
      })
    }

    let [data, state] = createResource(fetcher, { key: "long-soak-key" })
    let expectedValue: string | undefined

    for (let step = 0; step < 48; step += 1) {
      const op = nextOp()

      if (op === 0) {
        expectedValue = `local-${step}`
        state.mutate(expectedValue)
      } else if (op === 1) {
        state.refetch()
        const currentCall = calls
        pendingResolvers.get(currentCall)?.(`server-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expectedValue = `server-${step}`
      } else if (op === 2) {
        invalidateResource("long-soak-key")
        ;[data, state] = createResource(fetcher, { key: "long-soak-key" })
        const currentCall = calls
        pendingResolvers.get(currentCall)?.(`recreated-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expectedValue = `recreated-${step}`
      } else {
        state.refetch()
        const staleCall = calls
        invalidateResource("long-soak-key")
        ;[data, state] = createResource(fetcher, { key: "long-soak-key" })
        pendingResolvers.get(staleCall)?.(`stale-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        const currentCall = calls
        pendingResolvers.get(currentCall)?.(`fresh-${step}`)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expectedValue = `fresh-${step}`
      }

      expect(state.error()).toBeUndefined()
      expect(state.loading()).toBe(false)
      expect(data()).toBe(expectedValue)
    }
  })

  test("createMutation keeps isPending true until all concurrent mutations settle", async () => {
    let resolveFirst!: (value: number) => void
    let resolveSecond!: (value: number) => void
    let callCount = 0

    const mutation = createMutation<number, number>({
      mutationFn: async (value) => {
        callCount += 1
        if (callCount === 1) {
          return await new Promise<number>((resolve) => {
            resolveFirst = resolve
          })
        }
        return await new Promise<number>((resolve) => {
          resolveSecond = resolve
        })
      },
    })

    const first = mutation.mutate(1)
    const second = mutation.mutate(2)
    expect(mutation.isPending()).toBe(true)

    resolveSecond(2)
    await Promise.resolve()
    await Promise.resolve()
    expect(mutation.isPending()).toBe(true)

    resolveFirst(1)
    await Promise.all([first, second])
    expect(mutation.isPending()).toBe(false)
    expect(mutation.data()).toBe(1)
  })

  test("createMutation keeps isPending true while one concurrent mutation fails and another is still pending", async () => {
    let rejectFirst!: (reason?: unknown) => void
    let resolveSecond!: (value: number) => void
    let callCount = 0

    const mutation = createMutation<number, number>({
      mutationFn: async (value) => {
        callCount += 1
        if (callCount === 1) {
          return await new Promise<number>((_, reject) => {
            rejectFirst = reject
          })
        }
        return await new Promise<number>((resolve) => {
          resolveSecond = resolve
        })
      },
    })

    const first = mutation.mutate(1).catch((error) => error)
    const second = mutation.mutate(2)
    expect(mutation.isPending()).toBe(true)

    rejectFirst(new Error("first failed"))
    await Promise.resolve()
    await Promise.resolve()
    expect(mutation.isPending()).toBe(true)
    expect(mutation.error()?.message).toBe("first failed")

    resolveSecond(2)
    await second
    await first

    expect(mutation.isPending()).toBe(false)
    expect(mutation.data()).toBe(2)
  })

  test("createMutation reset suppresses stale in-flight completion state", async () => {
    let resolveMutation!: (value: number) => void

    const mutation = createMutation<number, number>({
      mutationFn: async (value) => {
        return await new Promise<number>((resolve) => {
          resolveMutation = resolve
        })
      },
    })

    const pending = mutation.mutate(7)
    expect(mutation.isPending()).toBe(true)

    mutation.reset()
    expect(mutation.isPending()).toBe(false)
    expect(mutation.data()).toBeUndefined()
    expect(mutation.error()).toBeUndefined()

    resolveMutation(7)
    await pending

    expect(mutation.isPending()).toBe(false)
    expect(mutation.data()).toBeUndefined()
    expect(mutation.error()).toBeUndefined()
  })

  test("optimistic rollback does not clobber a newer optimistic layer", async () => {
    let rejectFirst!: (reason?: unknown) => void
    let resolveSecond!: (value: string) => void
    let callCount = 0
    const [items, setItems] = createSignal<string[]>([])

    const mutation = createMutation<string, string>({
      mutationFn: async (value) => {
        callCount += 1
        if (callCount === 1) {
          return await new Promise<string>((_, reject) => {
            rejectFirst = reject
          })
        }
        return await new Promise<string>((resolve) => {
          resolveSecond = resolve
        })
      },
    })

    const first = mutation.optimistic(items, setItems, (current, value) => [...current, value], "first").catch((error) => error)
    const second = mutation.optimistic(items, setItems, (current, value) => [...current, value], "second")

    expect(items()).toEqual(["first", "second"])

    rejectFirst(new Error("first failed"))
    await Promise.resolve()
    await Promise.resolve()
    expect(items()).toEqual(["first", "second"])

    resolveSecond("second")
    await second
    await first
    expect(items()).toEqual(["first", "second"])
  })

  test("createLive does not reconnect after close even if a retry timer was scheduled", async () => {
    const scheduled: Array<() => void> = []
    const sockets: FakeSocket[] = []

    class FakeSocket {
      static OPEN = 1
      readyState = 0
      listeners = new Map<string, Array<() => void>>()

      constructor(_url: string) {
        sockets.push(this)
      }

      addEventListener(type: string, handler: () => void) {
        const existing = this.listeners.get(type) ?? []
        existing.push(handler)
        this.listeners.set(type, existing)
      }

      emit(type: string) {
        for (const handler of this.listeners.get(type) ?? []) handler()
      }

      send() {}

      close() {
        this.emit("close")
      }
    }

    ;(globalThis as Record<string, unknown>).WebSocket = FakeSocket
    globalThis.setTimeout = (((fn: TimerHandler) => {
      scheduled.push(fn as () => void)
      return 1 as unknown as Timer
    }) as unknown) as typeof setTimeout

    const live = createLive({ url: "ws://localhost/live", initialValue: "init", reconnectDelay: 5 })
    expect(sockets).toHaveLength(1)

    sockets[0]!.emit("close")
    expect(scheduled).toHaveLength(1)

    live.close()
    scheduled[0]!()

    expect(sockets).toHaveLength(1)
    expect(live.connected()).toBe(false)
  })

  test("createLive schedules only one reconnect for repeated close events on the same socket", () => {
    const scheduled: Array<() => void> = []
    const sockets: FakeSocket[] = []

    class FakeSocket {
      static OPEN = 1
      readyState = 0
      listeners = new Map<string, Array<() => void>>()

      constructor(_url: string) {
        sockets.push(this)
      }

      addEventListener(type: string, handler: () => void) {
        const existing = this.listeners.get(type) ?? []
        existing.push(handler)
        this.listeners.set(type, existing)
      }

      emit(type: string) {
        for (const handler of this.listeners.get(type) ?? []) handler()
      }

      send() {}
      close() {}
    }

    ;(globalThis as Record<string, unknown>).WebSocket = FakeSocket
    globalThis.setTimeout = (((fn: TimerHandler) => {
      scheduled.push(fn as () => void)
      return 1 as unknown as Timer
    }) as unknown) as typeof setTimeout

    createLive({ url: "ws://localhost/live", initialValue: "init", reconnectDelay: 5 })
    expect(sockets).toHaveLength(1)

    sockets[0]!.emit("close")
    sockets[0]!.emit("close")

    expect(scheduled).toHaveLength(1)
  })

  test("createLive cancels a stale reconnect timer after the socket opens again", () => {
    const scheduled: Array<() => void> = []
    const sockets: FakeSocket[] = []

    class FakeSocket {
      static OPEN = 1
      readyState = 0
      listeners = new Map<string, Array<() => void>>()

      constructor(_url: string) {
        sockets.push(this)
      }

      addEventListener(type: string, handler: () => void) {
        const existing = this.listeners.get(type) ?? []
        existing.push(handler)
        this.listeners.set(type, existing)
      }

      emit(type: string) {
        for (const handler of this.listeners.get(type) ?? []) handler()
      }

      send() {}
      close() {}
    }

    ;(globalThis as Record<string, unknown>).WebSocket = FakeSocket
    globalThis.setTimeout = (((fn: TimerHandler) => {
      scheduled.push(fn as () => void)
      return 1 as unknown as Timer
    }) as unknown) as typeof setTimeout

    const live = createLive({ url: "ws://localhost/live", initialValue: "init", reconnectDelay: 5 })
    expect(sockets).toHaveLength(1)

    sockets[0]!.emit("close")
    expect(scheduled).toHaveLength(1)

    sockets[0]!.emit("open")
    scheduled[0]!()

    expect(sockets).toHaveLength(1)
    expect(live.connected()).toBe(true)
  })
})
