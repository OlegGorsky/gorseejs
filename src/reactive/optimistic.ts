// Optimistic mutations — update UI instantly, rollback on server error
// Killer feature: no framework has this built-in at reactive level

import { createSignal, type SignalGetter } from "./signal.ts"
import {
  trackMutationCreated,
  trackMutationError,
  trackMutationReset,
  trackMutationRollback,
  trackMutationSettled,
  trackMutationStart,
  trackMutationSuccess,
} from "./diagnostics.ts"

export interface MutationOptions<T, V> {
  mutationFn: (variables: V) => Promise<T>
  onSuccess?: (data: T, variables: V) => void
  onError?: (error: Error, variables: V) => void
  onSettled?: (data: T | undefined, error: Error | undefined) => void
  label?: string
}

export interface MutationState<T> {
  readonly data: SignalGetter<T | undefined>
  readonly error: SignalGetter<Error | undefined>
  readonly isPending: SignalGetter<boolean>
}

export interface Mutation<T, V> extends MutationState<T> {
  mutate: (variables: V) => Promise<T>
  /** Optimistic: update signal immediately, rollback if server fails */
  optimistic: <S>(
    signal: SignalGetter<S>,
    setter: (current: S) => void,
    update: (current: S, variables: V) => S,
    variables: V,
  ) => Promise<T>
  reset: () => void
}

export function createMutation<T, V = void>(
  options: MutationOptions<T, V>,
): Mutation<T, V> {
  const mutationNodeId = trackMutationCreated(options.label)
  const [data, setData] = createSignal<T | undefined>(undefined)
  const [error, setError] = createSignal<Error | undefined>(undefined)
  const [isPending, setIsPending] = createSignal(false)

  async function mutate(variables: V): Promise<T> {
    trackMutationStart(mutationNodeId, options.label)
    setIsPending(true)
    setError(undefined)
    try {
      const result = await options.mutationFn(variables)
      setData(result)
      trackMutationSuccess(mutationNodeId, options.label)
      options.onSuccess?.(result, variables)
      options.onSettled?.(result, undefined)
      return result
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      trackMutationError(mutationNodeId, options.label, e.message)
      options.onError?.(e, variables)
      options.onSettled?.(undefined, e)
      throw e
    } finally {
      trackMutationSettled(mutationNodeId, options.label)
      setIsPending(false)
    }
  }

  async function optimistic<S>(
    signal: SignalGetter<S>,
    setter: (val: S) => void,
    update: (current: S, variables: V) => S,
    variables: V,
  ): Promise<T> {
    const previous = signal()
    // Apply optimistic update immediately
    setter(update(previous, variables))
    try {
      return await mutate(variables)
    } catch (err) {
      // Rollback on failure
      setter(previous)
      trackMutationRollback(mutationNodeId, options.label)
      throw err
    }
  }

  function reset(): void {
    trackMutationReset(mutationNodeId, options.label)
    setData(undefined)
    setError(undefined)
    setIsPending(false)
  }

  return { data, error, isPending, mutate, optimistic, reset }
}
