// Suspense component -- shows fallback while async resources load
// Works with createResource() from reactive module

import { createSignal } from "../reactive/signal.ts"
import type { GorseeRenderable } from "./renderable.ts"

export interface SuspenseProps {
  fallback: GorseeRenderable
  children: GorseeRenderable
}

type AsyncChild = () => Promise<GorseeRenderable>

// Client-side Suspense: renders fallback, then swaps to content when ready
export function Suspense(props: SuspenseProps): GorseeRenderable {
  const children = props.children

  // If children is a function that returns a promise, handle async
  if (typeof children === "function") {
    const asyncFn = children as AsyncChild
    const [resolved, setResolved] = createSignal<GorseeRenderable>(null)
    const [pending, setPending] = createSignal(true)

    asyncFn().then((result) => {
      setResolved(result)
      setPending(false)
    }).catch((err) => {
      setResolved(err instanceof Error ? err.message : String(err))
      setPending(false)
    })

    // Return a reactive choice between fallback and resolved
    return () => pending() ? props.fallback : resolved()
  }

  // Synchronous children -- just return them
  return children
}
