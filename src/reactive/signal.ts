import { signal as alienSignal } from "alien-signals"
import { trackSignalCreated, trackSignalRead, trackSignalWrite, type ReactiveDiagnosticOptions } from "./diagnostics.ts"
import { GORSEE_SIGNAL_MARKER } from "../runtime/html-escape.ts"

export type SignalGetter<T> = () => T
export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void

export function createSignal<T>(initialValue: T, options: ReactiveDiagnosticOptions = {}): [SignalGetter<T>, SignalSetter<T>] {
  const s = alienSignal(initialValue)
  const nodeId = trackSignalCreated(options.label)

  const getter: SignalGetter<T> = () => {
    trackSignalRead(nodeId, options.label)
    return s()
  }
  ;((getter as unknown) as Record<string, unknown>)[GORSEE_SIGNAL_MARKER] = true

  const setter: SignalSetter<T> = (value) => {
    trackSignalWrite(nodeId, options.label)
    if (typeof value === "function") {
      s((value as (prev: T) => T)(s()))
    } else {
      s(value)
    }
  }

  return [getter, setter]
}
