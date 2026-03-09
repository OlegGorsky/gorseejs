export const RPC_PROTOCOL_VERSION = 1 as const
export const RPC_CONTENT_TYPE = "application/vnd.gorsee-rpc+json"
export const RPC_ACCEPTED_CONTENT_TYPES = [RPC_CONTENT_TYPE, "application/json"] as const

export interface RPCRequestEnvelope {
  v: typeof RPC_PROTOCOL_VERSION
  args: unknown[]
}

export interface RPCSuccessEnvelope {
  v: typeof RPC_PROTOCOL_VERSION
  ok: true
  encoding: "devalue"
  data: string
}

export interface RPCErrorEnvelope {
  v: typeof RPC_PROTOCOL_VERSION
  ok: false
  error: string
}

export type RPCResponseEnvelope = RPCSuccessEnvelope | RPCErrorEnvelope

export function encodeRPCSuccess(data: string): RPCSuccessEnvelope {
  return {
    v: RPC_PROTOCOL_VERSION,
    ok: true,
    encoding: "devalue",
    data,
  }
}

export function encodeRPCError(error: string): RPCErrorEnvelope {
  return {
    v: RPC_PROTOCOL_VERSION,
    ok: false,
    error,
  }
}

export function decodeRPCRequest(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== "object") return null
  const candidate = body as Partial<RPCRequestEnvelope>
  if (candidate.v !== RPC_PROTOCOL_VERSION) return null
  if (!Array.isArray(candidate.args)) return null
  return candidate.args
}
