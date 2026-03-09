import { emitAIEvent, type AIEventSource, type AITraceContext } from "../ai/index.ts"
import type { RuntimeRequestSurface } from "./request-surface.ts"

type DispatchableRuntimeSurface = Exclude<RuntimeRequestSurface, "hmr">

export interface RuntimeDispatchResult {
  surface: DispatchableRuntimeSurface
  response: Response
}

export interface RuntimeDispatchOptions {
  plan: DispatchableRuntimeSurface[]
  pathname: string
  request: Request
  trace: Pick<AITraceContext, "requestId" | "traceId" | "spanId">
  startTs: number
  source: AIEventSource
  route?: string
  handlers: Partial<Record<DispatchableRuntimeSurface, () => Promise<Response | null>>>
}

export async function dispatchRuntimeRequestPlan(
  options: RuntimeDispatchOptions,
): Promise<RuntimeDispatchResult | null> {
  for (const surface of options.plan) {
    const handler = options.handlers[surface]
    if (!handler) continue

    const response = await handler()
    if (!response) continue

    if (surface === "not-found") {
      await emitAIEvent({
        kind: "route.miss",
        severity: "warn",
        source: options.source,
        message: "no route matched",
        requestId: options.trace.requestId,
        traceId: options.trace.traceId,
        spanId: options.trace.spanId,
        durationMs: Number((performance.now() - options.startTs).toFixed(2)),
        data: {
          method: options.request.method,
          pathname: options.pathname,
        },
      })
    } else {
      await emitAIEvent({
        kind: "request.finish",
        severity: response.status >= 400 ? "warn" : "info",
        source: options.source,
        message: describeSurfaceMessage(surface),
        requestId: options.trace.requestId,
        traceId: options.trace.traceId,
        spanId: options.trace.spanId,
        route: options.route,
        durationMs: Number((performance.now() - options.startTs).toFixed(2)),
        data: {
          method: options.request.method,
          pathname: options.pathname,
          status: response.status,
          handler: describeSurfaceHandler(surface, response),
        },
      })
    }

    return { surface, response }
  }

  return null
}

function describeSurfaceMessage(surface: DispatchableRuntimeSurface): string {
  switch (surface) {
    case "rpc":
      return "rpc request handled"
    case "bundle":
      return "client bundle served"
    case "static":
      return "static asset served"
    case "prerendered":
      return "prerendered page served"
    case "route":
      return "route request handled"
    case "not-found":
      return "no route matched"
  }
}

function describeSurfaceHandler(surface: DispatchableRuntimeSurface, response: Response): string {
  if (surface === "route") {
    return response.headers.get("Content-Type")?.includes("application/json")
      ? "partial"
      : "route"
  }
  return surface
}
