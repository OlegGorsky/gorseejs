import type { AIHealthReport, AIStorePaths } from "./store.ts"
import { buildAIHealthReport, readAIDiagnosticsSnapshot, readAIEvents } from "./store.ts"
import { isRecord, MAX_AI_JSON_BYTES, safeJSONParse } from "./json.ts"

interface JSONRPCRequest {
  jsonrpc: "2.0"
  id?: string | number | null
  method: string
  params?: unknown
}

interface JSONRPCResponse {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
  }
}

export interface AIMCPServerOptions {
  paths: AIStorePaths
  limit?: number
}

export function createAIMCPServer(options: AIMCPServerOptions) {
  async function handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse | null> {
    switch (request.method) {
      case "initialize":
        return ok(request.id, {
          protocolVersion: "2025-06-18",
          serverInfo: { name: "gorsee-ai-mcp", version: "0.1.0" },
          capabilities: {
            tools: {},
          },
        })
      case "notifications/initialized":
        return null
      case "tools/list":
        return ok(request.id, {
          tools: [
            {
              name: "gorsee_ai_recent_events",
              description: "Read the most recent structured AI/runtime/build/check events.",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number" },
                },
              },
            },
            {
              name: "gorsee_ai_diagnostics",
              description: "Read the latest AI diagnostics snapshot.",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "gorsee_ai_doctor",
              description: "Summarize current AI health, incidents, and diagnostics for the workspace.",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number" },
                },
              },
            },
          ],
        })
      case "tools/call":
        try {
          return ok(request.id, await callTool(request.params))
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool invocation failed"
          return err(request.id, -32602, message)
        }
      default:
        return err(request.id, -32601, `Method not found: ${request.method}`)
    }
  }

  async function serve(input: AsyncIterable<string>, output: { write(chunk: string): void }): Promise<void> {
    for await (const line of input) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let request: JSONRPCRequest
      request = safeJSONParse<JSONRPCRequest>(trimmed, { maxBytes: MAX_AI_JSON_BYTES }) as JSONRPCRequest
      if (!request) {
        output.write(`${JSON.stringify(err(null, -32700, "Parse error"))}\n`)
        continue
      }
      const response = await handleRequest(request)
      if (response) output.write(`${JSON.stringify(response)}\n`)
    }
  }

  return {
    handleRequest,
    serve,
  }

  async function callTool(params: unknown): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const { name, limit } = parseToolCall(params, options.limit)

    if (name === "gorsee_ai_recent_events") {
      const events = await readAIEvents(options.paths.eventsPath, { limit })
      return text(JSON.stringify(events, null, 2))
    }
    if (name === "gorsee_ai_diagnostics") {
      const snapshot = await readAIDiagnosticsSnapshot(options.paths.diagnosticsPath)
      return text(JSON.stringify(snapshot ?? {}, null, 2))
    }
    if (name === "gorsee_ai_doctor") {
      const report = await buildAIHealthReport(options.paths, { limit })
      return text(renderDoctorText(report))
    }

    throw new Error(`Unknown tool: ${name}`)
  }
}

function parseToolCall(params: unknown, defaultLimit?: number): { name: string; limit: number } {
  if (!isRecord(params)) {
    throw new Error("Invalid params: expected tool call object")
  }

  const { name, arguments: args } = params
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("Invalid params: tool name is required")
  }
  if (args !== undefined && !isRecord(args)) {
    throw new Error("Invalid params: arguments must be an object")
  }

  const rawLimit = args?.limit
  if (rawLimit !== undefined && typeof rawLimit !== "number") {
    throw new Error("Invalid params: limit must be a number")
  }

  return {
    name,
    limit: Math.max(1, Math.min(rawLimit ?? defaultLimit ?? 50, 500)),
  }
}

export function createLineReader(input: NodeJS.ReadStream): AsyncIterable<string> {
  const decoder = new TextDecoder()
  return {
    async *[Symbol.asyncIterator]() {
      let buffer = ""
      for await (const chunk of input) {
        buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true })
        while (buffer.includes("\n")) {
          const index = buffer.indexOf("\n")
          const line = buffer.slice(0, index)
          buffer = buffer.slice(index + 1)
          yield line
        }
      }
      if (buffer.length > 0) yield buffer
    },
  }
}

function renderDoctorText(report: AIHealthReport): string {
  const lines = [
    ...(report.app
      ? [
          `App mode: ${report.app.mode}`,
          `Runtime topology: ${report.app.runtimeTopology}`,
        ]
      : []),
    `Events: ${report.events.total}`,
    `Diagnostics: ${report.diagnostics.total}`,
    `Errors: ${report.diagnostics.errors}`,
    `Warnings: ${report.diagnostics.warnings}`,
  ]
  if (report.events.latest) {
    lines.push(`Latest event: ${report.events.latest.kind} at ${report.events.latest.ts}`)
  }
  if (report.diagnostics.latest?.code) {
    lines.push(`Latest diagnostic: ${report.diagnostics.latest.code} ${report.diagnostics.latest.message ?? ""}`.trim())
  }
  if (report.incidents.length > 0) {
    lines.push("Incidents:")
    for (const incident of report.incidents.slice(0, 5)) {
      lines.push(`- [${incident.kind}] ${incident.message}`)
    }
  }
  if (report.incidentClusters.length > 0) {
    lines.push("Incident clusters:")
    for (const cluster of report.incidentClusters.slice(0, 5)) {
      const loc = cluster.file ? ` (${cluster.file})` : cluster.route ? ` (${cluster.route})` : ""
      lines.push(`- [${cluster.kind}] x${cluster.count}${loc}`)
    }
  }
  if (report.artifactRegressions.length > 0) {
    lines.push("Artifact regressions:")
    for (const artifact of report.artifactRegressions.slice(0, 5)) {
      const details = [artifact.version, artifact.path].filter(Boolean).join(" ")
      lines.push(`- [${artifact.phase}] errors=${artifact.errors} warnings=${artifact.warnings} successes=${artifact.successes}${details ? ` (${details})` : ""}`)
    }
  }
  return lines.join("\n")
}

function text(value: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: value }] }
}

function ok(id: string | number | null | undefined, result: unknown): JSONRPCResponse {
  return { jsonrpc: "2.0", id: id ?? null, result }
}

function err(id: string | number | null | undefined, code: number, message: string): JSONRPCResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }
}
