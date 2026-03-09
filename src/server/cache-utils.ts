import type { CacheEntry, CacheStore } from "./cache.ts"

export function createNamespacedCacheStore(store: CacheStore, namespace: string): CacheStore {
  const prefix = `${namespace}:`
  return {
    get: (key) => store.get(prefix + key),
    set: async (key, entry) => { await store.set(prefix + key, entry) },
    delete: async (key) => { await store.delete(prefix + key) },
    clear: async () => {
      const keys = await store.keys()
      for await (const key of keys) {
        if (key.startsWith(prefix)) await store.delete(key)
      }
    },
    keys: async function* () {
      const keys = await store.keys()
      for await (const key of keys) {
        if (!key.startsWith(prefix)) continue
        yield key.slice(prefix.length)
      }
    },
  }
}
