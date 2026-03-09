import { effect as alienEffect } from "alien-signals"
import { runTrackedComputation, trackEffectCreated, type ReactiveDiagnosticOptions } from "./diagnostics.ts"

export type CleanupFn = () => void

export function createEffect(fn: () => void, options: ReactiveDiagnosticOptions = {}): CleanupFn {
  const nodeId = trackEffectCreated(options.label)
  return alienEffect(() => runTrackedComputation(nodeId, "effect", options.label, fn))
}
