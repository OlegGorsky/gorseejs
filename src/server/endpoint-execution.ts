import { createContext, runMiddlewareChain, type Context, type MiddlewareFn } from "./middleware.ts"
import {
  attachRequestMetadata,
  resolveRequestExecutionPolicy,
  resolveRequestMetadata,
  validateRequestPolicy,
  type RequestExecutionKind,
  type RequestExecutionPolicy,
  type RequestMetadata,
} from "./request-policy.ts"
import {
  createRequestSecurityPolicy,
  validateRequestSecurityPolicy,
  type RequestSecurityPolicy,
} from "./request-security-policy.ts"
import { createTraceIds } from "../ai/index.ts"

export interface EndpointExecutionTrace {
  requestId?: string
  traceId?: string
  spanId?: string
  parentSpanId?: string
}

export interface EndpointExecutionContext {
  ctx: Context
  metadata: RequestMetadata
  requestPolicy: RequestExecutionPolicy
  securityPolicy: RequestSecurityPolicy
}

export interface EndpointExecutionOptions {
  request: Request
  kind: RequestExecutionKind
  params?: Record<string, string>
  trustedOrigin?: string
  trustForwardedHeaders?: boolean
  trustedForwardedHops?: number
  securityPolicy?: RequestSecurityPolicy
  middlewares?: MiddlewareFn[]
  trace?: EndpointExecutionTrace
  handler: (context: EndpointExecutionContext) => Promise<Response>
}

export async function executeEndpointRequest(
  options: EndpointExecutionOptions,
): Promise<Response> {
  const trace = options.trace?.requestId && options.trace?.traceId && options.trace?.spanId
    ? options.trace
    : createTraceIds(options.trace)
  const securityPolicy = options.securityPolicy ?? createRequestSecurityPolicy({
    trustedOrigin: options.trustedOrigin,
    trustForwardedHeaders: options.trustForwardedHeaders,
    trustedForwardedHops: options.trustedForwardedHops,
  })
  const requestPolicy = resolveRequestExecutionPolicy(options.kind)
  const ctx = createContext(options.request, options.params ?? {}, {
    trustedOrigin: securityPolicy.trustedOrigin,
  })
  const metadata = resolveRequestMetadata(options.request, {
    trustedOrigin: securityPolicy.trustedOrigin,
    kind: options.kind,
    visibility: requestPolicy.visibility,
    trustForwardedHeaders: securityPolicy.trustForwardedHeaders,
    trustedForwardedHops: securityPolicy.trustedForwardedHops,
  })

  ctx.locals.requestId = trace.requestId
  ctx.locals.traceId = trace.traceId
  ctx.locals.spanId = trace.spanId
  if (trace.parentSpanId) ctx.locals.parentSpanId = trace.parentSpanId

  attachRequestMetadata(ctx.locals, metadata, requestPolicy)

  const violation = validateRequestSecurityPolicy(metadata, requestPolicy, securityPolicy)
    ?? validateRequestPolicy(metadata, requestPolicy)
  if (violation) return violation

  return runMiddlewareChain(options.middlewares ?? [], ctx, () =>
    options.handler({ ctx, metadata, requestPolicy, securityPolicy }))
}
