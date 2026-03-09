import { describe, expect, test } from "bun:test"
import { createAuth, createMemorySessionStore, createNamespacedSessionStore } from "../../src/auth/index.ts"
import { createContext } from "../../src/server/middleware.ts"
import { createMemoryCacheStore, routeCache } from "../../src/server/cache.ts"
import { createNamespacedCacheStore } from "../../src/server/cache-utils.ts"
import { __registerRPC, __resetRPCState, createMemoryRPCRegistry } from "../../src/server/rpc.ts"
import { createScopedRPCRegistry } from "../../src/server/rpc-utils.ts"

describe("adapter boundaries", () => {
  test("createAuth accepts custom session store", async () => {
    const store = createMemorySessionStore()
    const auth = createAuth({ secret: "adapter-secret", store })
    const ctx = createContext(new Request("http://localhost/"))

    await auth.login(ctx, "user-1")
    const session = auth.getSession(ctx)

    expect(session).not.toBeNull()
    expect((await store.get(session!.id))?.userId).toBe("user-1")
  })

  test("createNamespacedSessionStore isolates auth state by namespace", async () => {
    const sharedStore = createMemorySessionStore()
    const authA = createAuth({ secret: "adapter-secret", store: createNamespacedSessionStore(sharedStore, "tenant-a") })
    const authB = createAuth({ secret: "adapter-secret", store: createNamespacedSessionStore(sharedStore, "tenant-b") })
    const ctxA = createContext(new Request("http://localhost/a"))
    const ctxB = createContext(new Request("http://localhost/b"))

    await authA.login(ctxA, "user-a")

    expect(authA.getSession(ctxA)?.userId).toBe("user-a")
    expect(authB.getSession(ctxB)).toBeNull()
  })

  test("routeCache accepts custom cache store", async () => {
    const store = createMemoryCacheStore()
    const cache = routeCache({ maxAge: 60, store })
    const ctx = createContext(new Request("http://localhost/test"))

    const first = await cache(ctx, async () => new Response("ok"))
    const second = await cache(ctx, async () => new Response("changed"))

    expect(first.headers.get("X-Cache")).toBe("MISS")
    expect(second.headers.get("X-Cache")).toBe("HIT")
    const keys: string[] = []
    for await (const key of await store.keys()) keys.push(key)
    expect(keys).toHaveLength(1)
  })

  test("createNamespacedCacheStore isolates cache keys by namespace", async () => {
    const sharedStore = createMemoryCacheStore()
    const cacheA = routeCache({ maxAge: 60, store: createNamespacedCacheStore(sharedStore, "tenant-a") })
    const cacheB = routeCache({ maxAge: 60, store: createNamespacedCacheStore(sharedStore, "tenant-b") })
    const ctx = createContext(new Request("http://localhost/test"))

    await cacheA(ctx, async () => new Response("tenant-a"))
    const response = await cacheB(ctx, async () => new Response("tenant-b"))

    expect(await response.text()).toBe("tenant-b")
  })

  test("createMemoryRPCRegistry provides isolated registry", async () => {
    const registry = createMemoryRPCRegistry()
    const handler = async () => "ok"

    registry.setHandler("id-1", handler)

    expect(registry.getHandler("id-1")).toBe(handler)
    expect(registry.getFileCallCount("/file.tsx")).toBe(0)
    registry.setFileCallCount("/file.tsx", 2)
    expect(registry.getFileCallCount("/file.tsx")).toBe(2)
    registry.clear()
    expect(registry.getHandler("id-1")).toBeUndefined()
  })

  test("createScopedRPCRegistry isolates handlers by scope", async () => {
    const sharedRegistry = createMemoryRPCRegistry()
    const scopeA = createScopedRPCRegistry(sharedRegistry, "tenant-a")
    const scopeB = createScopedRPCRegistry(sharedRegistry, "tenant-b")

    scopeA.setHandler("sum", async () => 1)
    scopeB.setHandler("sum", async () => 2)

    expect(await scopeA.getHandler("sum")?.()).toBe(1)
    expect(await scopeB.getHandler("sum")?.()).toBe(2)

    scopeA.clear()
    expect(scopeA.getHandler("sum")).toBeUndefined()
    expect(await scopeB.getHandler("sum")?.()).toBe(2)
  })

  test("default RPC registry still works through public API", () => {
    __resetRPCState()
    const handler = async () => "ok"
    __registerRPC("id-public", handler)
    expect(typeof handler).toBe("function")
  })
})
