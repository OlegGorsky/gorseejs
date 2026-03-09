// server() function + RPC registry
// On server: registers function for RPC with hash(filePath:index)
// On client: replaced by build plugin with fetch() stub

import { stringify } from "devalue"
import { hashRPC } from "./rpc-hash.ts"
import {
  decodeRPCRequest,
  encodeRPCError,
  encodeRPCSuccess,
  RPC_ACCEPTED_CONTENT_TYPES,
  RPC_CONTENT_TYPE,
} from "./rpc-protocol.ts"

export interface ServerOptions {}
const MAX_RPC_PAYLOAD = 1024 * 1024 // 1MB

export type RPCHandler = (...args: unknown[]) => Promise<unknown>

export interface RPCRegistry {
  getHandler(id: string): RPCHandler | undefined
  setHandler(id: string, fn: RPCHandler): void
  deleteHandler(id: string): void
  clear(): void
  getFileCallCount(file: string): number
  setFileCallCount(file: string, count: number): void
}

export function createMemoryRPCRegistry(): RPCRegistry {
  const rpcHandlers = new Map<string, RPCHandler>()
  const fileCallCounters = new Map<string, number>()
  return {
    getHandler: (id) => rpcHandlers.get(id),
    setHandler: (id, fn) => { rpcHandlers.set(id, fn) },
    deleteHandler: (id) => { rpcHandlers.delete(id) },
    clear: () => {
      rpcHandlers.clear()
      fileCallCounters.clear()
    },
    getFileCallCount: (file) => fileCallCounters.get(file) ?? 0,
    setFileCallCount: (file, count) => { fileCallCounters.set(file, count) },
  }
}

const defaultRPCRegistry = createMemoryRPCRegistry()

export function __registerRPC(id: string, fn: RPCHandler): void {
  defaultRPCRegistry.setHandler(id, fn)
}

export function __resetRPCState(): void {
  defaultRPCRegistry.clear()
}

export function getRPCHandler(id: string): RPCHandler | undefined {
  return defaultRPCRegistry.getHandler(id)
}

function getCallerFile(): string | null {
  const orig = Error.prepareStackTrace
  Error.prepareStackTrace = (_err, stack) => stack
  const err = new Error()
  const stack = err.stack as unknown as NodeJS.CallSite[]
  Error.prepareStackTrace = orig

  // Walk up stack: 0=getCallerFile, 1=server(), 2=caller (route file)
  for (let i = 2; i < stack.length; i++) {
    const file = stack[i]?.getFileName()
    if (file && !file.includes("/server/rpc.ts") && !file.includes("node_modules")) {
      return file
    }
  }
  return null
}

// server() wrapper -- registers with hash-based ID matching client transform
export function server<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  _options?: ServerOptions
): (...args: TArgs) => Promise<TReturn> {
  const callerFile = getCallerFile()
  if (callerFile) {
    const counter = defaultRPCRegistry.getFileCallCount(callerFile)
    defaultRPCRegistry.setFileCallCount(callerFile, counter + 1)
    const id = hashRPC(callerFile, counter)
    defaultRPCRegistry.setHandler(id, fn as (...args: unknown[]) => Promise<unknown>)
  }
  return fn
}

export async function handleRPCRequestWithRegistry(
  request: Request,
  registry: Pick<RPCRegistry, "getHandler">,
): Promise<Response | null> {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/api\/_rpc\/([a-zA-Z0-9]+)$/)
  if (!match) return null
  if (request.method !== "POST") {
    return new Response(JSON.stringify(encodeRPCError("Method not allowed")), {
      status: 405,
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        "Allow": "POST",
      },
    })
  }

  const id = match[1]!
  const handler = registry.getHandler(id)

  if (!handler) {
    return new Response(JSON.stringify(encodeRPCError(`RPC handler not found: ${id}`)), {
      status: 404,
      headers: { "Content-Type": RPC_CONTENT_TYPE },
    })
  }

  try {
    let args: unknown[] = []
    const contentLength = Number(request.headers.get("content-length") ?? "0")
    if (contentLength > MAX_RPC_PAYLOAD) {
      return new Response(JSON.stringify(encodeRPCError("Request body too large")), {
        status: 413,
        headers: { "Content-Type": RPC_CONTENT_TYPE },
      })
    }
    // Read body with actual size limit (Content-Length can be spoofed)
    const reader = request.body?.getReader()
    let bodyBytes = 0
    const chunks: Uint8Array[] = []
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bodyBytes += value.byteLength
        if (bodyBytes > MAX_RPC_PAYLOAD) {
          reader.cancel()
          return new Response(JSON.stringify(encodeRPCError("Request body too large")), {
            status: 413,
            headers: { "Content-Type": RPC_CONTENT_TYPE },
          })
        }
        chunks.push(value)
      }
    }
    const body = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : Buffer.concat(chunks),
    )
    if (body) {
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        return new Response(JSON.stringify(encodeRPCError("Invalid JSON in request body")), {
          status: 400,
          headers: { "Content-Type": RPC_CONTENT_TYPE },
        })
      }
      const decodedArgs = decodeRPCRequest(parsed)
      if (!decodedArgs) {
        return new Response(JSON.stringify(encodeRPCError("RPC args must be an array")), {
          status: 400,
          headers: { "Content-Type": RPC_CONTENT_TYPE },
        })
      }
      args = decodedArgs
    }

    const result = await handler(...args)
    const serialized = stringify(result)
    if (Buffer.byteLength(serialized, "utf-8") > MAX_RPC_PAYLOAD) {
      return new Response(JSON.stringify(encodeRPCError("Response body too large")), {
        status: 413,
        headers: { "Content-Type": RPC_CONTENT_TYPE },
      })
    }

    return new Response(JSON.stringify(encodeRPCSuccess(serialized)), {
      status: 200,
      headers: { "Content-Type": RPC_CONTENT_TYPE },
    })
  } catch (err) {
    // Don't leak internal error details to the client
    const isDev = process.env.NODE_ENV !== "production"
    const message = isDev && err instanceof Error ? err.message : "Internal server error"
    return new Response(JSON.stringify(encodeRPCError(message)), {
      status: 500,
      headers: { "Content-Type": RPC_CONTENT_TYPE },
    })
  }
}

export { RPC_CONTENT_TYPE, RPC_ACCEPTED_CONTENT_TYPES }

// RPC HTTP handler
export async function handleRPCRequest(request: Request): Promise<Response | null> {
  return handleRPCRequestWithRegistry(request, defaultRPCRegistry)
}
