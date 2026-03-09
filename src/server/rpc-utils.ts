import type { RPCRegistry } from "./rpc.ts"

export function createScopedRPCRegistry(registry: RPCRegistry, scope: string): RPCRegistry {
  const prefix = `${scope}:`
  const fileCounters = new Map<string, number>()
  const scopedIds = new Set<string>()
  return {
    getHandler: (id) => registry.getHandler(prefix + id),
    setHandler: (id, fn) => {
      const scopedId = prefix + id
      scopedIds.add(scopedId)
      registry.setHandler(scopedId, fn)
    },
    deleteHandler: (id) => {
      const scopedId = prefix + id
      scopedIds.delete(scopedId)
      registry.deleteHandler(scopedId)
    },
    clear: () => {
      for (const scopedId of scopedIds) registry.deleteHandler(scopedId)
      scopedIds.clear()
      fileCounters.clear()
    },
    getFileCallCount: (file) => fileCounters.get(file) ?? 0,
    setFileCallCount: (file, count) => { fileCounters.set(file, count) },
  }
}
