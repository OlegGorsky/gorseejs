import { handleRPCRequest, handleRPCRequestWithRegistry, type RPCRegistry } from "./rpc.ts"
import type { MiddlewareFn } from "./middleware.ts"
import { executeServerExecution } from "./server-execution.ts"
import {
  createRequestSecurityPolicy,
  type RequestSecurityPolicy,
} from "./request-security-policy.ts"

interface RateLimitResult {
  allowed: boolean
  resetAt: number
}

interface RateLimiterLike {
  check(key: string): RateLimitResult | Promise<RateLimitResult>
}

export async function createRateLimitResponse(
  rateLimiter: RateLimiterLike,
  key: string,
): Promise<Response | null> {
  const result = await rateLimiter.check(key)
  if (result.allowed) return null
  const retryAfterSeconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))

  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSeconds),
    },
  })
}

export function applyResponseHeaders(
  response: Response,
  headers: Record<string, string>,
): Response {
  for (const key in headers) response.headers.set(key, headers[key]!)
  return response
}

export interface RPCRequestOptions {
  registry?: Pick<RPCRegistry, "getHandler">
  middlewares?: MiddlewareFn[]
  trustedOrigin?: string
  trustForwardedHeaders?: boolean
  trustedForwardedHops?: number
  securityPolicy?: RequestSecurityPolicy
}

export async function handleRPCWithHeaders(
  request: Request,
  headers: Record<string, string>,
  options: RPCRequestOptions = {},
): Promise<Response | null> {
  const response = await handleRPCRequestWithPolicy(request, options)
  if (!response) return null
  return applyResponseHeaders(response, headers)
}

export async function handleRPCRequestWithPolicy(
  request: Request,
  options: RPCRequestOptions = {},
): Promise<Response | null> {
  const { registry, middlewares = [] } = options
  const pathname = new URL(request.url).pathname
  if (!/^\/api\/_rpc\/[a-zA-Z0-9]+$/.test(pathname)) return null

  const securityPolicy = options.securityPolicy ?? createRequestSecurityPolicy({
    trustedOrigin: options.trustedOrigin,
    trustForwardedHeaders: options.trustForwardedHeaders,
    trustedForwardedHops: options.trustedForwardedHops,
  })

  const response = await executeServerExecution({
    request,
    kind: "rpc",
    securityPolicy,
    middlewares,
    route: pathname,
    handler: async () =>
      registry
        ? (await handleRPCRequestWithRegistry(request, registry))!
        : (await handleRPCRequest(request))!,
  })
  return response
}
