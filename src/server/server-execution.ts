import { executeEndpointRequest, type EndpointExecutionContext, type EndpointExecutionTrace } from "./endpoint-execution.ts"
import type { MiddlewareFn } from "./middleware.ts"
import type { RequestExecutionKind } from "./request-policy.ts"
import type { RequestSecurityPolicy } from "./request-security-policy.ts"
import { createTraceIds, emitAIEvent } from "../ai/index.ts"

export type ServerExecutionKind = Exclude<RequestExecutionKind, "static">

export interface ServerExecutionContext extends EndpointExecutionContext {
  kind: ServerExecutionKind
  trace: EndpointExecutionTrace
}

export interface ServerExecutionOptions {
  request: Request
  kind: ServerExecutionKind
  params?: Record<string, string>
  middlewares?: MiddlewareFn[]
  trustedOrigin?: string
  trustForwardedHeaders?: boolean
  securityPolicy?: RequestSecurityPolicy
  trace?: EndpointExecutionTrace
  route?: string
  handler: (context: ServerExecutionContext) => Promise<Response>
}

export async function executeServerExecution(
  options: ServerExecutionOptions,
): Promise<Response> {
  const trace = options.trace?.requestId && options.trace?.traceId && options.trace?.spanId
    ? options.trace
    : createTraceIds(options.trace)
  const pathname = new URL(options.request.url).pathname

  await emitAIEvent({
    kind: `${options.kind}.start`,
    severity: "info",
    source: "runtime",
    message: `${options.kind} request received`,
    requestId: trace.requestId,
    traceId: trace.traceId,
    spanId: trace.spanId,
    parentSpanId: trace.parentSpanId,
    route: options.route,
    data: {
      method: options.request.method,
      pathname,
      middlewareCount: options.middlewares?.length ?? 0,
    },
  })

  const response = await executeEndpointRequest({
    request: options.request,
    kind: options.kind,
    params: options.params,
    middlewares: options.middlewares,
    trustedOrigin: options.trustedOrigin,
    trustForwardedHeaders: options.trustForwardedHeaders,
    securityPolicy: options.securityPolicy,
    trace,
    handler: async (context) => options.handler({
      ...context,
      kind: options.kind,
      trace,
    }),
  })

  await emitAIEvent({
    kind: `${options.kind}.finish`,
    severity: response.status >= 400 ? "warn" : "info",
    source: "runtime",
    message: `${options.kind} request completed`,
    requestId: trace.requestId,
    traceId: trace.traceId,
    spanId: trace.spanId,
    parentSpanId: trace.parentSpanId,
    route: options.route,
    data: {
      method: options.request.method,
      pathname,
      status: response.status,
    },
  })

  return response
}
