import { computed as alienComputed } from "alien-signals"
import {
  runTrackedComputation,
  trackComputedCreated,
  trackComputedRead,
  type ReactiveDiagnosticOptions,
} from "./diagnostics.ts"
import { GORSEE_SIGNAL_MARKER } from "../runtime/html-escape.ts"

export type ComputedGetter<T> = () => T

export function createComputed<T>(fn: () => T, options: ReactiveDiagnosticOptions = {}): ComputedGetter<T> {
  const nodeId = trackComputedCreated(options.label)
  const computed = alienComputed(() => runTrackedComputation(nodeId, "computed", options.label, fn))
  const getter = () => {
    trackComputedRead(nodeId, options.label)
    return computed()
  }
  ;((getter as unknown) as Record<string, unknown>)[GORSEE_SIGNAL_MARKER] = true
  return getter
}
