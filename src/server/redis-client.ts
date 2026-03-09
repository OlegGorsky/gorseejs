type Awaitable<T> = T | Promise<T>

export interface RedisLikeClient {
  get(key: string): Awaitable<string | null>
  set(key: string, value: string): Awaitable<unknown>
  del(key: string): Awaitable<number>
  keys(pattern: string): Awaitable<string[]>
  incr?(key: string): Awaitable<number>
  expire?(key: string, seconds: number): Awaitable<number>
  pttl?(key: string): Awaitable<number>
  ttl?(key: string): Awaitable<number>
}

export function buildRedisKey(prefix: string, key: string): string {
  return `${prefix}:${key}`
}

export function stripRedisPrefix(prefix: string, key: string): string {
  const expected = `${prefix}:`
  return key.startsWith(expected) ? key.slice(expected.length) : key
}

export interface NodeRedisClientLike {
  get(key: string): Awaitable<string | null>
  set(key: string, value: string): Awaitable<unknown>
  del(key: string): Awaitable<number>
  keys(pattern: string): Awaitable<string[]>
  incr?(key: string): Awaitable<number>
  expire?(key: string, seconds: number): Awaitable<number>
  pttl?(key: string): Awaitable<number>
  ttl?(key: string): Awaitable<number>
}

export interface IORedisClientLike {
  get(key: string): Awaitable<string | null>
  set(key: string, value: string): Awaitable<unknown>
  del(key: string): Awaitable<number>
  keys(pattern: string): Awaitable<string[]>
  incr?(key: string): Awaitable<number>
  expire?(key: string, seconds: number): Awaitable<number>
  pttl?(key: string): Awaitable<number>
  ttl?(key: string): Awaitable<number>
}

export function createNodeRedisLikeClient(client: NodeRedisClientLike): RedisLikeClient {
  return {
    get: (key) => client.get(key),
    set: (key, value) => client.set(key, value),
    del: (key) => client.del(key),
    keys: (pattern) => client.keys(pattern),
    incr: client.incr ? (key) => client.incr!(key) : undefined,
    expire: client.expire ? (key, seconds) => client.expire!(key, seconds) : undefined,
    pttl: client.pttl ? (key) => client.pttl!(key) : undefined,
    ttl: client.ttl ? (key) => client.ttl!(key) : undefined,
  }
}

export function createIORedisLikeClient(client: IORedisClientLike): RedisLikeClient {
  return createNodeRedisLikeClient(client)
}

export async function deleteExpiredRedisKeys(
  client: RedisLikeClient,
  pattern: string,
  now: number,
  parseCreatedAt: (value: string) => number | undefined,
  maxEntryAgeMs: number,
): Promise<number> {
  let deleted = 0
  for (const key of await client.keys(pattern)) {
    const raw = await client.get(key)
    if (raw === null) continue
    const createdAt = parseCreatedAt(raw)
    if (createdAt === undefined) continue
    if (createdAt > now - maxEntryAgeMs) continue
    deleted += await client.del(key)
  }
  return deleted
}
