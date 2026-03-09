import { appendFile, mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import type { AIDiagnostic, AIEvent } from "./index.ts"
import { isRecord, MAX_AI_JSON_BYTES, safeJSONParse } from "./json.ts"

export interface AIBridgeServerOptions {
  port?: number
  path?: string
  host?: string
  maxEvents?: number
  maxBodyBytes?: number
  persistPath?: string
  onEvent?: (event: AIEvent) => void | Promise<void>
}

export interface AIBridgeSnapshot {
  updatedAt: string | null
  events: AIEvent[]
  diagnostics: AIDiagnostic[]
}

export interface AIBridgeHandler {
  fetch(request: Request): Promise<Response> | Response
  snapshot(): AIBridgeSnapshot
}

export interface AIBridgeServer {
  port: number
  stop(closeActiveConnections?: boolean): void
  snapshot(): AIBridgeSnapshot
}

export function createAIBridgeHandler(options: AIBridgeServerOptions = {}): AIBridgeHandler {
  const path = options.path ?? "/gorsee/ai-events"
  const maxEvents = options.maxEvents ?? 200
  const maxBodyBytes = options.maxBodyBytes ?? MAX_AI_JSON_BYTES
  const events: AIEvent[] = []
  const diagnostics: AIDiagnostic[] = []
  let updatedAt: string | null = null

  return {
    async fetch(request) {
      const url = new URL(request.url)

      if (request.method === "GET" && url.pathname === `${path}/health`) {
        return Response.json({ status: "ok", updatedAt })
      }

      if (request.method === "GET" && url.pathname === `${path}/events`) {
        return Response.json(snapshot())
      }

      if (request.method !== "POST" || url.pathname !== path) {
        return new Response("Not Found", { status: 404 })
      }

      const contentType = request.headers.get("content-type") ?? ""
      if (!contentType.includes("application/json")) {
        return Response.json({ error: "Unsupported media type" }, { status: 415 })
      }
      const contentLength = Number(request.headers.get("content-length") ?? "0")
      if (contentLength > maxBodyBytes) {
        return Response.json({ error: "Payload too large" }, { status: 413 })
      }
      const raw = await request.text()
      if (Buffer.byteLength(raw, "utf-8") > maxBodyBytes) {
        return Response.json({ error: "Payload too large" }, { status: 413 })
      }
      const event = safeJSONParse<AIEvent>(raw, { maxBytes: maxBodyBytes })
      if (!event || !isValidAIEvent(event)) {
        return Response.json({ error: "Invalid AI event payload" }, { status: 400 })
      }
      updatedAt = event.ts
      events.push(event)
      if (events.length > maxEvents) events.shift()

      if (event.kind === "diagnostic.issue") {
        diagnostics.push({
          code: event.code ?? "UNKNOWN",
          message: event.message,
          severity: event.severity === "debug" ? "info" : event.severity,
          source: event.source,
          file: event.file,
          line: event.line,
          route: event.route,
          fix: typeof event.data?.fix === "string" ? event.data.fix : undefined,
          ts: event.ts,
        })
        if (diagnostics.length > maxEvents) diagnostics.shift()
      }

      if (options.persistPath) {
        await mkdir(dirname(options.persistPath), { recursive: true })
        await appendFile(options.persistPath, `${JSON.stringify(event)}\n`, "utf-8")
      }
      if (options.onEvent) await options.onEvent(event)

      return Response.json({ ok: true })
    },
    snapshot,
  }

  function snapshot(): AIBridgeSnapshot {
    return {
      updatedAt,
      events: [...events],
      diagnostics: [...diagnostics],
    }
  }
}

function isValidAIEvent(value: AIEvent): boolean {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.kind === "string"
    && typeof value.severity === "string"
    && typeof value.ts === "string"
    && typeof value.source === "string"
    && typeof value.message === "string"
}

export function createAIBridgeServer(options: AIBridgeServerOptions = {}): AIBridgeServer {
  const handler = createAIBridgeHandler(options)
  const server = Bun.serve({
    hostname: options.host ?? "127.0.0.1",
    port: options.port ?? 4318,
    fetch: handler.fetch,
  })

  return {
    port: server.port ?? options.port ?? 4318,
    stop(closeActiveConnections = false) {
      server.stop(closeActiveConnections)
    },
    snapshot() {
      return handler.snapshot()
    },
  }
}
