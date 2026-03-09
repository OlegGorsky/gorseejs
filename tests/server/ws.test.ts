import { describe, test, expect } from "bun:test"
import { joinRoom, leaveRoom, broadcastToRoom, getRoomSize, createWSContext } from "../../src/server/ws.ts"

describe("WebSocket rooms", () => {
  function mockWS(): { sent: string[]; closed: boolean; ws: ReturnType<typeof createWSContext> } {
    const sent: string[] = []
    const mock = {
      send(data: string) { sent.push(data) },
      close() { mock.closed = true },
      closed: false,
    }
    return { sent, closed: false, ws: createWSContext(mock) }
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
})
