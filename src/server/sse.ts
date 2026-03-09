export interface SSEOptions {
  headers?: Record<string, string>
}

export interface SSEStream {
  response: Response
  send: (event: string, data: unknown) => void
  close: () => void
}

export function createSSEStream(options?: SSEOptions): SSEStream {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl
    },
    cancel() {
      controller = null
    },
  })

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...options?.headers,
    },
  })

  function send(event: string, data: unknown): void {
    if (!controller) return
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    controller.enqueue(encoder.encode(payload))
  }

  function close(): void {
    if (controller) {
      controller.close()
      controller = null
    }
  }

  return { response, send, close }
}
