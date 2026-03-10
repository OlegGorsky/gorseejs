import { describe, test, expect } from "bun:test"
import { joinRoom, leaveRoom, broadcastToRoom, getRoomSize, createWSContext } from "../../src/server/ws.ts"

describe("WebSocket rooms", () => {
  function mockWS(): {
    sent: Array<string | ArrayBuffer>
    closed: boolean
    closeArgs: Array<number | string | undefined>
    ws: ReturnType<typeof createWSContext>
  } {
    const closeArgs: Array<number | string | undefined> = []
    const sent: string[] = []
    const mock = {
      send(data: string | ArrayBuffer) { sent.push(data as string) },
      close(code?: number, reason?: string) {
        mock.closed = true
        closeArgs.push(code, reason)
      },
      closed: false,
    }
    return { sent, closed: false, closeArgs, ws: createWSContext(mock) }
  }

  test("join and broadcast to room", () => {
    const a = mockWS()
    const b = mockWS()

    joinRoom("chat", a.ws)
    joinRoom("chat", b.ws)

    expect(getRoomSize("chat")).toBe(2)

    broadcastToRoom("chat", "hello")
    expect(a.sent).toEqual(["hello"])
    expect(b.sent).toEqual(["hello"])
  })

  test("broadcast excludes sender", () => {
    const a = mockWS()
    const b = mockWS()

    joinRoom("room1", a.ws)
    joinRoom("room1", b.ws)

    broadcastToRoom("room1", "from a", a.ws)
    expect(a.sent).toHaveLength(0)
    expect(b.sent).toEqual(["from a"])
  })

  test("leave room", () => {
    const a = mockWS()
    joinRoom("room2", a.ws)
    expect(getRoomSize("room2")).toBe(1)

    leaveRoom("room2", a.ws)
    expect(getRoomSize("room2")).toBe(0)
  })

  test("createWSContext generates unique IDs", () => {
    const a = mockWS()
    const b = mockWS()
    expect(a.ws.id).not.toBe(b.ws.id)
    expect(a.ws.id).toMatch(/^ws_\d+$/)
  })

  test("joining the same socket twice does not duplicate room membership", () => {
    const a = mockWS()
    joinRoom("dedupe-room", a.ws)
    joinRoom("dedupe-room", a.ws)
    expect(getRoomSize("dedupe-room")).toBe(1)
    leaveRoom("dedupe-room", a.ws)
  })

  test("broadcast continues when one socket send throws", () => {
    const bad = createWSContext({
      send() {
        throw new Error("broken socket")
      },
      close() {},
    })
    const good = mockWS()

    joinRoom("resilient-room", bad)
    joinRoom("resilient-room", good.ws)

    expect(() => broadcastToRoom("resilient-room", "resilient")).not.toThrow()
    expect(good.sent).toEqual(["resilient"])

    leaveRoom("resilient-room", bad)
    leaveRoom("resilient-room", good.ws)
  })

  test("createWSContext forwards close arguments", () => {
    const a = mockWS()
    a.ws.close(1000, "done")
    expect(a.closeArgs).toEqual([1000, "done"])
  })

  test("leaving an unknown room is a no-op and empty broadcasts do not throw", () => {
    const a = mockWS()
    expect(() => leaveRoom("missing-room", a.ws)).not.toThrow()
    expect(() => broadcastToRoom("missing-room", "noop")).not.toThrow()
  })

  test("ws contexts forward binary payloads without coercion", () => {
    const a = mockWS()
    const payload = new Uint8Array([1, 2, 3]).buffer

    a.ws.send(payload)

    expect(a.sent[0]).toBe(payload)
  })
})
