import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createAIMCPServer } from "../../src/ai/index.ts"

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
          version: "0.2.4",
          artifact: "gorsee-0.2.4.tgz",
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
    expect(text).toContain("Events:")
    expect(text).toContain("Diagnostics:")
    expect(text).toContain("Incident clusters:")
    expect(text).toContain("Artifact regressions:")
    expect(text).toContain("gorsee-0.2.4.tgz")
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
})
