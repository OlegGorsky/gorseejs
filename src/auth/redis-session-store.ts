import type { Session, SessionStore } from "./index.ts"
import { buildRedisKey, stripRedisPrefix, type RedisLikeClient } from "../server/redis-client.ts"

interface RedisSessionStoreOptions {
  prefix?: string
}

interface StoredSessionPayload {
  session: Session
}

export function createRedisSessionStore(
  client: RedisLikeClient,
  options: RedisSessionStoreOptions = {},
): SessionStore {
  const prefix = options.prefix ?? "gorsee:session"

  return {
    async get(id) {
      const raw = await client.get(buildRedisKey(prefix, id))
      if (!raw) return undefined
      try {
        const payload = JSON.parse(raw) as StoredSessionPayload
        return payload.session
      } catch {
        await client.del(buildRedisKey(prefix, id))
        return undefined
      }
    },
    async set(id, session) {
      const key = buildRedisKey(prefix, id)
      await client.set(key, JSON.stringify({ session } satisfies StoredSessionPayload))
      const ttlSeconds = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000))
      if (client.expire) await client.expire(key, ttlSeconds)
    },
    async delete(id) {
      await client.del(buildRedisKey(prefix, id))
    },
    async entries() {
      const keys = await client.keys(`${prefix}:*`)
      const sessions: Array<[string, Session]> = []
      for (const key of keys) {
        const raw = await client.get(key)
        if (!raw) continue
        try {
          const payload = JSON.parse(raw) as StoredSessionPayload
          sessions.push([stripRedisPrefix(prefix, key), payload.session])
        } catch {
          await client.del(key)
        }
      }
      return sessions
    },
  }
}
