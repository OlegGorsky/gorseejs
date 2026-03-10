import { createSignal, type SignalGetter } from "./signal.ts"
import {
  trackResourceCreated,
  trackResourceInvalidation,
  trackResourceLoadError,
  trackResourceLoadStart,
  trackResourceLoadSuccess,
  trackResourceMutate,
  trackResourceRefetch,
} from "./diagnostics.ts"

export interface ResourceOptions {
  /** Initial data (skip first fetch) */
  initialData?: unknown
  /** Retry count on failure (default: 0) */
  retry?: number
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number
  /** Cache key for deduplication */
  key?: string
  /** Stale time in ms — refetch after this period */
  staleTime?: number
  /** Optional diagnostics label for reactive tracing */
  label?: string
}

export interface ResourceState<T> {
  loading: SignalGetter<boolean>
  error: SignalGetter<Error | undefined>
  refetch: () => void
  mutate: (value: T | undefined | ((prev: T | undefined) => T | undefined)) => void
}

export type ResourceReturn<T> = [SignalGetter<T | undefined>, ResourceState<T>]

// Simple in-memory cache for resource deduplication
interface CacheEntry {
  data: unknown
  fetchedAt: number
  promise?: Promise<unknown>
}

const resourceCache = new Map<string, CacheEntry>()
const resourceCacheEpochs = new Map<string, number>()

function getCacheEpoch(key: string): number {
  return resourceCacheEpochs.get(key) ?? 0
}

function bumpCacheEpoch(key: string): number {
  const nextEpoch = getCacheEpoch(key) + 1
  resourceCacheEpochs.set(key, nextEpoch)
  return nextEpoch
}

export function invalidateResource(key: string): void {
  bumpCacheEpoch(key)
  resourceCache.delete(key)
  trackResourceInvalidation(key, "resource.invalidate")
}

export function invalidateAll(): void {
  for (const key of resourceCache.keys()) {
    bumpCacheEpoch(key)
    trackResourceInvalidation(key, "resource.invalidateAll")
  }
  resourceCache.clear()
}

export function createResource<T>(
  fetcher: () => Promise<T>,
  options?: ResourceOptions,
): ResourceReturn<T> {
  const retryCount = options?.retry ?? 0
  const retryDelay = options?.retryDelay ?? 1000
  const cacheKey = options?.key
  const staleTime = options?.staleTime
  const diagnosticsLabel = options?.label ?? cacheKey
  const resourceNodeId = trackResourceCreated(diagnosticsLabel, cacheKey)

  // Check cache
  const cached = cacheKey ? resourceCache.get(cacheKey) : undefined
  const hasValidCache = cached && staleTime && (Date.now() - cached.fetchedAt < staleTime)
  const initialValue = hasValidCache ? cached.data as T : options?.initialData as T | undefined

  const [data, setData] = createSignal<T | undefined>(initialValue)
  const [loading, setLoading] = createSignal(!hasValidCache)
  const [error, setError] = createSignal<Error | undefined>(undefined)
  let currentLoadId = 0

  function writeCachedValue(value: T | undefined): void {
    if (!cacheKey) return
    resourceCache.set(cacheKey, {
      data: value,
      fetchedAt: Date.now(),
    })
  }

  async function fetchWithRetry(attempt: number): Promise<T> {
    try {
      return await fetcher()
    } catch (err) {
      if (attempt < retryCount) {
        await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)))
        return fetchWithRetry(attempt + 1)
      }
      throw err
    }
  }

  const load = (forceFresh = false) => {
    const loadId = ++currentLoadId
    // Deduplicate: if another resource with same key is already fetching, reuse promise
    if (cacheKey && !forceFresh) {
      const entry = resourceCache.get(cacheKey)
      if (entry?.promise) {
        const cacheEpoch = getCacheEpoch(cacheKey)
        trackResourceLoadStart(resourceNodeId, diagnosticsLabel, cacheKey, "deduped")
        entry.promise.then((result) => {
          if (loadId !== currentLoadId) return
          if (getCacheEpoch(cacheKey) !== cacheEpoch) {
            setLoading(false)
            return
          }
          setData(() => result as T)
          setLoading(false)
          trackResourceLoadSuccess(resourceNodeId, diagnosticsLabel, cacheKey)
        }).catch((err) => {
          if (loadId !== currentLoadId) return
          if (getCacheEpoch(cacheKey) !== cacheEpoch) {
            setLoading(false)
            return
          }
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
          trackResourceLoadError(resourceNodeId, diagnosticsLabel, cacheKey, err instanceof Error ? err.message : String(err))
        })
        return
      }
    }

    const cacheEpoch = cacheKey ? bumpCacheEpoch(cacheKey) : 0

    setLoading(true)
    setError(undefined)
    trackResourceLoadStart(resourceNodeId, diagnosticsLabel, cacheKey)

    const promise = fetchWithRetry(0)

    // Store promise in cache for dedup
    if (cacheKey) {
      const entry = resourceCache.get(cacheKey) ?? { data: undefined, fetchedAt: 0 }
      entry.promise = promise
      resourceCache.set(cacheKey, entry)
    }

    promise
      .then((result) => {
        if (loadId !== currentLoadId) return
        if (cacheKey && getCacheEpoch(cacheKey) !== cacheEpoch) {
          setLoading(false)
          return
        }
        setData(() => result)
        setLoading(false)
        trackResourceLoadSuccess(resourceNodeId, diagnosticsLabel, cacheKey)
        if (cacheKey) {
          resourceCache.set(cacheKey, { data: result, fetchedAt: Date.now() })
        }
      })
      .catch((err) => {
        if (loadId !== currentLoadId) return
        if (cacheKey && getCacheEpoch(cacheKey) !== cacheEpoch) {
          setLoading(false)
          return
        }
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
        trackResourceLoadError(resourceNodeId, diagnosticsLabel, cacheKey, err instanceof Error ? err.message : String(err))
        if (cacheKey) {
          const entry = resourceCache.get(cacheKey)
          if (entry) entry.promise = undefined
        }
      })
  }

  // Don't fetch if we have valid cache
  if (!hasValidCache) {
    load()
  }

  return [
    data,
    {
      loading,
      error,
      refetch: () => {
        trackResourceRefetch(resourceNodeId, diagnosticsLabel, cacheKey)
        load(true)
      },
      mutate: (value) => {
        trackResourceMutate(resourceNodeId, diagnosticsLabel, cacheKey)
        currentLoadId++
        if (cacheKey) bumpCacheEpoch(cacheKey)
        setLoading(false)
        setError(undefined)
        if (typeof value === "function") {
          const nextValue = (value as (prev: T | undefined) => T | undefined)(data())
          setData(() => nextValue)
          writeCachedValue(nextValue)
        } else {
          setData(() => value)
          writeCachedValue(value)
        }
      },
    },
  ]
}
