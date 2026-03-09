// WebSocket support for real-time features
// Routes can export a `ws` handler for WebSocket connections

export interface WSContext {
  send(data: string | ArrayBuffer): void
  close(code?: number, reason?: string): void
  id: string
}

export type WSHandler = {
  open?: (ws: WSContext) => void
  message?: (ws: WSContext, data: string | ArrayBuffer) => void
  close?: (ws: WSContext) => void
}

// Room-based pub/sub for common real-time patterns
const rooms = new Map<string, Set<WSContext>>()

export function joinRoom(room: string, ws: WSContext): void {
  let members = rooms.get(room)
  if (!members) {
    members = new Set()
    rooms.set(room, members)
  }
  members.add(ws)
}

export function leaveRoom(room: string, ws: WSContext): void {
  const members = rooms.get(room)
  if (!members) return
  members.delete(ws)
  if (members.size === 0) rooms.delete(room)
}

export function broadcastToRoom(room: string, data: string, exclude?: WSContext): void {
  const members = rooms.get(room)
  if (!members) return
  for (const ws of members) {
    if (ws === exclude) continue
    try { ws.send(data) } catch {}
  }
}

export function getRoomSize(room: string): number {
  return rooms.get(room)?.size ?? 0
}

let wsIdCounter = 0

export function createWSContext(ws: { send(data: string | ArrayBuffer): void; close(code?: number, reason?: string): void }): WSContext {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    id: `ws_${++wsIdCounter}`,
  }
}
