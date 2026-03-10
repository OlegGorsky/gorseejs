import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createAIMCPServer } from "../../src/ai/index.ts"

const ROOT_PACKAGE = JSON.parse(await Bun.file(join(process.cwd(), "package.json")).text()) as {
  version: string
}
const RELEASE_TARBALL = `gorsee-${ROOT_PACKAGE.version}.tgz`

describe("ai mcp server", () => {
  const TMP = join(process.cwd(), ".tmp-ai-mcp")

  test("lists tools and serves doctor output", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), [
      JSON.stringify({
        id: "evt-1",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "boom",
        requestId: "req-1",
        route: "/login",
        app: {
          mode: "fullstack",
          runtimeTopology: "single-instance",
        },
      }),
      JSON.stringify({
        id: "evt-2",
        kind: "diagnostic.issue",
        severity: "error",
        ts: new Date().toISOString(),
        source: "check",
        message: "boom",
        requestId: "req-1",
        route: "/login",
      }),
      JSON.stringify({
        id: "evt-3",
        kind: "release.smoke.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "cli",
        message: "release smoke failed",
        data: {
          version: ROOT_PACKAGE.version,
          artifact: RELEASE_TARBALL,
        },
      }),
    ].join("\n") + "\n")

    const server = createAIMCPServer({
      paths: {
        eventsPath: join(TMP, ".gorsee", "ai-events.jsonl"),
        diagnosticsPath: join(TMP, ".gorsee", "ai-diagnostics.json"),
        reactiveTracePath: join(TMP, ".gorsee", "reactive-trace.json"),
      },
    })

    const tools = await server.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    })
    expect((tools?.result as any).tools).toHaveLength(3)

    const doctor = await server.handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "gorsee_ai_doctor",
        arguments: { limit: 10 },
      },
    })
    const text = (doctor?.result as any).content[0].text as string
    expect(text).toContain("App mode: fullstack")
    expect(text).toContain("Runtime topology: single-instance")
    expect(text).toContain("Events:")
    expect(text).toContain("Diagnostics:")
    expect(text).toContain("Incident clusters:")
    expect(text).toContain("Artifact regressions:")
    expect(text).toContain(RELEASE_TARBALL)
  })

  test("returns parse error for malformed JSON-RPC input", async () => {
    const server = createAIMCPServer({
      paths: {
        eventsPath: join(TMP, ".gorsee", "ai-events.jsonl"),
        diagnosticsPath: join(TMP, ".gorsee", "ai-diagnostics.json"),
        reactiveTracePath: join(TMP, ".gorsee", "reactive-trace.json"),
      },
    })

    const chunks: string[] = []
    await server.serve(
      (async function* () {
        yield "{not valid json}\n"
      })(),
      { write(chunk: string) { chunks.push(chunk) } },
    )

    expect(chunks[0]).toContain('"code":-32700')
  })

  test("returns JSON-RPC invalid params for unknown tool names", async () => {
    const server = createAIMCPServer({
      paths: {
        eventsPath: join(TMP, ".gorsee", "ai-events.jsonl"),
        diagnosticsPath: join(TMP, ".gorsee", "ai-diagnostics.json"),
        reactiveTracePath: join(TMP, ".gorsee", "reactive-trace.json"),
      },
    })

    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "gorsee_ai_missing",
      },
    })

    expect(response?.error).toEqual({
      code: -32602,
      message: "Unknown tool: gorsee_ai_missing",
    })
  })

  test("returns JSON-RPC invalid params for malformed tool arguments", async () => {
    const server = createAIMCPServer({
      paths: {
        eventsPath: join(TMP, ".gorsee", "ai-events.jsonl"),
        diagnosticsPath: join(TMP, ".gorsee", "ai-diagnostics.json"),
        reactiveTracePath: join(TMP, ".gorsee", "reactive-trace.json"),
      },
    })

    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "gorsee_ai_recent_events",
        arguments: {
          limit: "bad",
        },
      },
    })

    expect(response?.error).toEqual({
      code: -32602,
      message: "Invalid params: limit must be a number",
    })
  })

  test("uses server-level default limit when tool arguments omit limit", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), [
      JSON.stringify({
        id: "evt-1",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "boom-1",
      }),
      JSON.stringify({
        id: "evt-2",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "boom-2",
      }),
    ].join("\n") + "\n")

    const server = createAIMCPServer({
      paths: {
        eventsPath: join(TMP, ".gorsee", "ai-events.jsonl"),
        diagnosticsPath: join(TMP, ".gorsee", "ai-diagnostics.json"),
        reactiveTracePath: join(TMP, ".gorsee", "reactive-trace.json"),
      },
      limit: 1,
    })

    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "gorsee_ai_recent_events",
      },
    })

    const events = JSON.parse(((response?.result as any).content[0].text as string)) as Array<Record<string, unknown>>
    expect(events).toHaveLength(1)
  })
})
