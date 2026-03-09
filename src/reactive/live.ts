import { createSignal, type SignalGetter } from "./signal.ts"

export interface LiveOptions<T> {
  url: string
  initialValue: T
  transform?: (data: unknown) => T
  reconnect?: boolean
  reconnectDelay?: number
}

export interface LiveSignal<T> {
  readonly value: SignalGetter<T>
  readonly connected: SignalGetter<boolean>
  send: (data: unknown) => void
  close: () => void
}

export function createLive<T>(options: LiveOptions<T>): LiveSignal<T> {
  const {
    url,
    initialValue,
    transform,
    reconnect = true,
    reconnectDelay = 1000,
  } = options

  const [value, setValue] = createSignal<T>(initialValue)
  const [connected, setConnected] = createSignal(false)

  let ws: WebSocket | null = null
  let closed = false
  let retryCount = 0

  function handleMessage(event: MessageEvent): void {
    try {
      const parsed: unknown = JSON.parse(String(event.data))
      const result = transform ? transform(parsed) : (parsed as T)
      setValue(result)
    } catch {
      // ignore malformed messages
    }
  }

  function handleOpen(): void {
    retryCount = 0
    setConnected(true)
  }

  function handleClose(): void {
    setConnected(false)
    ws = null
    if (!closed && reconnect) {
      scheduleReconnect()
    }
  }

  function scheduleReconnect(): void {
    const delay = Math.min(reconnectDelay * 2 ** retryCount, 30_000)
    retryCount++
    setTimeout(connect, delay)
  }

  function connect(): void {
    if (closed) return
    if (typeof globalThis.WebSocket === "undefined") return

    ws = new WebSocket(url)
    ws.addEventListener("open", handleOpen)
    ws.addEventListener("message", handleMessage)
    ws.addEventListener("close", handleClose)
    ws.addEventListener("error", () => {
      // error triggers close, handled there
    })
  }

  function send(data: unknown): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }

  function close(): void {
    closed = true
    if (ws) {
      ws.close()
      ws = null
    }
    setConnected(false)
  }

  // Only connect in browser environment
  if (typeof globalThis.WebSocket !== "undefined") {
    connect()
  }

  return { value, connected, send, close }
}
