import { createSignal, type SignalGetter } from "../reactive/signal.ts"

export interface EventSourceSignal<T> {
  readonly value: SignalGetter<T>
  readonly connected: SignalGetter<boolean>
  close: () => void
}

export function createEventSource<T>(
  url: string,
  event: string,
  initialValue: T,
): EventSourceSignal<T> {
  const [value, setValue] = createSignal<T>(initialValue)
  const [connected, setConnected] = createSignal(false)

  if (typeof globalThis.EventSource === "undefined") {
    return { value, connected, close: () => {} }
  }

  const source = new EventSource(url)

  source.addEventListener("open", () => {
    setConnected(true)
  })

  source.addEventListener(event, (e: MessageEvent) => {
    try {
      const parsed = JSON.parse(String(e.data)) as T
      setValue(parsed)
    } catch {
      // ignore malformed messages
    }
  })

  source.addEventListener("error", () => {
    setConnected(false)
  })

  function close(): void {
    source.close()
    setConnected(false)
  }

  return { value, connected, close }
}
