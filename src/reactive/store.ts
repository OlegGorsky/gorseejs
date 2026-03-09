import { createSignal, type SignalGetter, type SignalSetter } from "./signal.ts"

export type Store<T extends Record<string, unknown>> = {
  readonly [K in keyof T]: SignalGetter<T[K]>
}

export type SetStore<T extends Record<string, unknown>> = <K extends keyof T>(
  key: K,
  value: T[K] | ((prev: T[K]) => T[K])
) => void

export function createStore<T extends Record<string, unknown>>(
  initialValue: T
): [Store<T>, SetStore<T>] {
  const signals = new Map<keyof T, [SignalGetter<unknown>, SignalSetter<unknown>]>()

  for (const key of Object.keys(initialValue) as (keyof T)[]) {
    signals.set(key, createSignal<unknown>(initialValue[key]))
  }

  const store = new Proxy({} as Store<T>, {
    get(_target, prop: string) {
      const entry = signals.get(prop as keyof T)
      if (!entry) return undefined
      return entry[0]
    },
  })

  const setStore: SetStore<T> = (key, value) => {
    const entry = signals.get(key)
    if (!entry) return
    entry[1](value as unknown)
  }

  return [store, setStore]
}
