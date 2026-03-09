// RPC transform plugin for client bundles
// Replaces server() calls with fetch-based RPC stubs
// server(async (args) => { ... }) → async (args) => fetch("/_rpc/hash", ...)

import { hashRPC } from "../server/rpc-hash.ts"
import { RPC_CONTENT_TYPE, RPC_PROTOCOL_VERSION } from "../server/rpc-protocol.ts"

const DEVALUE_PARSE_MODULE = new URL("./devalue-parse.ts", import.meta.url).pathname

// Strip TypeScript type annotations from function args: "count: number, name: string" → "count, name"
function stripTypeAnnotations(args: string): string {
  return args.split(",").map((arg) => {
    const trimmed = arg.trim()
    // Handle destructuring, rest params, defaults — just strip ": Type" suffix
    return trimmed.replace(/\s*:\s*[^,=]+$/, "").replace(/\s*:\s*[^,=]+(?=\s*=)/, "")
  }).join(", ")
}

export function transformServerCalls(source: string, filePath: string): string {
  // Match server( followed by async/function — not inside strings
  const matches = [...source.matchAll(/\bserver\s*\(\s*(?=async\s|function\s)/g)]
  if (matches.length === 0) return source

  // Process in reverse order to preserve indices
  let result = source
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]!
    const start = match.index!
    const id = hashRPC(filePath, i)

    // Find the matching closing paren for server(...)
    let depth = 0
    let end = start
    for (let j = start; j < source.length; j++) {
      if (source[j] === "(") depth++
      else if (source[j] === ")") {
        depth--
        if (depth === 0) { end = j + 1; break }
      }
    }

    const inner = source.slice(start + match[0].length, end - 1)
    const argsMatch = inner.match(/^(async\s+)?(?:\(([^)]*)\)|(\w+))\s*=>/)
    const rawArgs = argsMatch ? (argsMatch[2] ?? argsMatch[3] ?? "") : ""
    const args = rawArgs ? stripTypeAnnotations(rawArgs) : "...args"

    const stub = `(async (${args}) => {
  const res = await fetch("/api/_rpc/${id}", {
    method: "POST",
    headers: { "Content-Type": "${RPC_CONTENT_TYPE}", "Accept": "${RPC_CONTENT_TYPE}" },
    body: JSON.stringify({ v: ${RPC_PROTOCOL_VERSION}, args: [${args}] })
  });
  if (!res.ok) throw new Error("RPC failed: " + res.status);
  const payload = await res.json();
  if (!payload || payload.ok !== true || payload.v !== ${RPC_PROTOCOL_VERSION} || payload.encoding !== "devalue") {
    throw new Error("RPC protocol mismatch");
  }
  return __gorseeDevalParse(payload.data);
})`

    result = result.slice(0, start) + stub + result.slice(end)
  }

  // Add devalue parse import at top
  return `import { parse as __gorseeDevalParse } from "${DEVALUE_PARSE_MODULE}";\n` + result
}
