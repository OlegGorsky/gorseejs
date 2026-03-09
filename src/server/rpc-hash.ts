// Shared RPC hash function -- must produce identical IDs on server and client
// ID = sha256(filePath + ":" + callIndex).slice(0, 12)

import { createHash } from "node:crypto"

export function hashRPC(filePath: string, index: number): string {
  return createHash("sha256")
    .update(`${filePath}:${index}`)
    .digest("hex")
    .slice(0, 12)
}

// Scan source for server() call positions and return their hashes
export function scanServerCalls(source: string, filePath: string): string[] {
  const matches = [...source.matchAll(/\bserver\s*\(\s*(?=async\s|function\s)/g)]
  return matches.map((_, i) => hashRPC(filePath, i))
}
