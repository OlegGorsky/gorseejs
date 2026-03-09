import { createMutation, type Mutation, type MutationOptions } from "./optimistic.ts"
import {
  createResource,
  invalidateAll,
  invalidateResource,
  type ResourceOptions,
} from "./resource.ts"
import type { SignalGetter } from "./signal.ts"

export interface DataQueryOptions<T> extends Omit<ResourceOptions, "key"> {
  key: string
  queryFn: () => Promise<T>
}

export interface DataQuery<T> {
  key: string
  data: SignalGetter<T | undefined>
  loading: SignalGetter<boolean>
  error: SignalGetter<Error | undefined>
  refetch: () => void
  setData: (value: T | undefined | ((prev: T | undefined) => T | undefined)) => void
  invalidate: () => void
}

export interface DataMutationOptions<T, V> extends MutationOptions<T, V> {
  invalidate?: string[] | ((data: T, variables: V) => string[] | "all")
}

export interface DataMutation<T, V> extends Mutation<T, V> {
  optimisticQuery: <S>(
    query: Pick<DataQuery<S>, "data" | "setData">,
    update: (current: S | undefined, variables: V) => S,
    variables: V,
  ) => Promise<T>
  invalidateQueries: (keys?: string[] | "all") => void
}

export function createDataQuery<T>(options: DataQueryOptions<T>): DataQuery<T> {
  const [data, state] = createResource(options.queryFn, {
    ...options,
    key: options.key,
  })

  return {
    key: options.key,
    data,
    loading: state.loading,
    error: state.error,
    refetch: state.refetch,
    setData: state.mutate,
    invalidate() {
      invalidateResource(options.key)
    },
  }
}

export function createDataMutation<T, V = void>(
  options: DataMutationOptions<T, V>,
): DataMutation<T, V> {
  let lastInvalidatedKeys: string[] | "all" | undefined

  const mutation = createMutation<T, V>({
    ...options,
    onSuccess(data, variables) {
      lastInvalidatedKeys = resolveInvalidationTargets(options.invalidate, data, variables)
      applyInvalidationTargets(lastInvalidatedKeys)
      options.onSuccess?.(data, variables)
    },
  })

  return {
    ...mutation,
    async optimisticQuery(query, update, variables) {
      return mutation.optimistic(
        query.data,
        (value) => query.setData(() => value),
        update,
        variables,
      )
    },
    invalidateQueries(keys = lastInvalidatedKeys ?? []) {
      applyInvalidationTargets(keys)
    },
  }
}

function resolveInvalidationTargets<T, V>(
  invalidate: DataMutationOptions<T, V>["invalidate"],
  data: T,
  variables: V,
): string[] | "all" {
  if (typeof invalidate === "function") {
    return invalidate(data, variables)
  }
  return invalidate ?? []
}

function applyInvalidationTargets(keys: string[] | "all"): void {
  if (keys === "all") {
    invalidateAll()
    return
  }
  for (const key of keys) {
    invalidateResource(key)
  }
}
