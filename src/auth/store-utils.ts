import type { Session, SessionStore } from "./index.ts"

export function createNamespacedSessionStore(store: SessionStore, namespace: string): SessionStore {
  const prefix = `${namespace}:`
  return {
    get: (id) => store.get(prefix + id),
    set: async (id, session) => {
      await store.set(prefix + id, { ...session, id })
    },
    delete: async (id) => {
      await store.delete(prefix + id)
    },
    entries: async function* () {
      const entries = await store.entries()
      for await (const [id, session] of entries) {
        if (!id.startsWith(prefix)) continue
        yield [id.slice(prefix.length), { ...(session as Session), id: id.slice(prefix.length) }] as [string, Session]
      }
    },
  }
}
