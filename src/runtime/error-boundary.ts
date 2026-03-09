// Client-side ErrorBoundary component
// Catches errors during rendering and shows fallback UI

import { createSignal } from "../reactive/signal.ts"
import type { GorseeRenderable } from "./renderable.ts"

export interface ErrorBoundaryProps {
  fallback: GorseeRenderable | ((error: Error) => GorseeRenderable)
  children: GorseeRenderable
}

export function ErrorBoundary(props: ErrorBoundaryProps): GorseeRenderable {
  const [error, setError] = createSignal<Error | null>(null)

  try {
    // Try to evaluate children
    const children = typeof props.children === "function"
      ? (props.children as () => GorseeRenderable)()
      : props.children
    return () => {
      const err = error()
      if (err) {
        return typeof props.fallback === "function"
          ? (props.fallback as (e: Error) => GorseeRenderable)(err)
          : props.fallback
      }
      return children
    }
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err))
    setError(errObj)
    return typeof props.fallback === "function"
      ? (props.fallback as (e: Error) => GorseeRenderable)(errObj)
      : props.fallback
}
}
