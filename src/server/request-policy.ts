import { isAllowedRequestOrigin } from "./middleware.ts"
import { isPartialNavigationRequest } from "./partial-navigation.ts"
import { RPC_ACCEPTED_CONTENT_TYPES } from "./rpc.ts"

type RouteModule = Record<string, unknown>

export type RequestExecutionKind =
  | "page"
  | "partial"
  | "action"
  | "route-handler"
  | "rpc"
  | "static"
export type RouteRequestExecutionKind = Exclude<RequestExecutionKind, "rpc" | "static">

export type RequestVisibility = "public" | "internal"
export type RequestAccess = "public" | "internal"
export type RequestMutation = "read" | "write"
export type RequestResponseShape = "document" | "data" | "raw"

export interface RequestMetadata {
  request: Request
  url: URL
  pathname: string
  method: string
  host: string
  protocol: string
  trustedOrigin?: string
  effectiveOrigin: string
  effectiveHost: string
  effectiveProto: string
  origin?: string
  forwarded?: string
  forwardedHost?: string
  forwardedProto?: string
  forwardedFor?: string
  proxyTrusted: boolean
  kind: RequestExecutionKind
  visibility: RequestVisibility
  access: RequestAccess
  mutation: RequestMutation
  isStateChanging: boolean
}

export interface RequestExecutionPolicy {
  kind: RequestExecutionKind
  visibility: RequestVisibility
  access: RequestAccess
  mutation: RequestMutation
  responseShape: RequestResponseShape
  requiresTrustedOrigin: boolean
  allowedContentTypes?: string[]
}

export interface RequestPolicyOptions {
  trustedOrigin?: string
  kind: RequestExecutionKind
  visibility?: RequestVisibility
  trustForwardedHeaders?: boolean
  trustedForwardedHops?: number
}

export interface RequestPolicyValidationOptions {
  allowedContentTypes?: string[]
}

export function resolveRequestMetadata(
  request: Request,
  options: RequestPolicyOptions,
): RequestMetadata {
  const url = new URL(request.url)
  const endpointContract = resolveRequestExecutionPolicy(options.kind)
  const urlProtocol = url.protocol.replace(/:$/, "")
  const trustedForwardedHops = options.trustForwardedHeaders === true
    ? Math.max(1, options.trustedForwardedHops ?? 1)
    : 0
  const forwarded = parseForwardedHeader(request.headers.get("forwarded"), trustedForwardedHops)
  const trustedForwardedHost = normalizeForwardedHost(
    getTrustedForwardedValue(request.headers.get("x-forwarded-host"), trustedForwardedHops),
  )
  const trustedForwardedProto = normalizeForwardedProto(
    getTrustedForwardedValue(request.headers.get("x-forwarded-proto"), trustedForwardedHops),
  )
  const trustedForwardedFor = normalizeForwardedFor(
    getTrustedForwardedValue(request.headers.get("x-forwarded-for"), trustedForwardedHops),
  )
  const forwardedHost = forwarded.host ?? trustedForwardedHost ?? undefined
  const forwardedProto = forwarded.proto ?? trustedForwardedProto ?? undefined
  const forwardedFor = forwarded.for ?? trustedForwardedFor ?? undefined
  const proxyTrusted = options.trustForwardedHeaders === true
  const effectiveHost = proxyTrusted ? forwardedHost ?? (request.headers.get("host") ?? url.host) : (request.headers.get("host") ?? url.host)
  const effectiveProto = proxyTrusted ? forwardedProto ?? urlProtocol : urlProtocol
  return {
    request,
    url,
    pathname: url.pathname,
    method: request.method,
    host: request.headers.get("host") ?? url.host,
    protocol: urlProtocol,
    trustedOrigin: options.trustedOrigin,
    effectiveOrigin: options.trustedOrigin ?? `${effectiveProto}://${effectiveHost}`,
    effectiveHost,
    effectiveProto,
    origin: request.headers.get("origin") ?? undefined,
    forwarded: request.headers.get("forwarded") ?? undefined,
    forwardedHost,
    forwardedProto,
    forwardedFor,
    proxyTrusted,
    kind: options.kind,
    visibility: options.visibility ?? defaultVisibilityForKind(options.kind),
    access: endpointContract.access,
    mutation: endpointContract.mutation,
    isStateChanging: isStateChangingMethod(request.method),
  }
}

export function classifyRouteRequest(mod: RouteModule, request: Request): RouteRequestExecutionKind {
  if ((typeof mod.GET === "function" && request.method === "GET") || (typeof mod.POST === "function" && request.method === "POST")) {
    return "route-handler"
  }
  if (request.method === "POST" && typeof mod.action === "function") {
    return "action"
  }
  if (isPartialNavigationRequest(request)) {
    return "partial"
  }
  return "page"
}

export function validateRequestPolicy(
  metadata: RequestMetadata,
  options: RequestPolicyValidationOptions & Partial<Pick<RequestExecutionPolicy, "requiresTrustedOrigin">> = {},
): Response | null {
  if (
    metadata.isStateChanging &&
    options.requiresTrustedOrigin !== false &&
    metadata.trustedOrigin &&
    !isAllowedRequestOrigin(metadata.request, metadata.trustedOrigin)
  ) {
    return new Response("Forbidden", { status: 403 })
  }

  if (options.allowedContentTypes && hasRequestBody(metadata.request)) {
    const contentType = metadata.request.headers.get("content-type") ?? ""
    if (!contentType) {
      return new Response("Unsupported Media Type", { status: 415 })
    }
    const isAllowed = options.allowedContentTypes.some((allowedType) => contentType.includes(allowedType))
    if (!isAllowed) {
      return new Response("Unsupported Media Type", { status: 415 })
    }
  }

  return null
}

export function resolveRequestExecutionPolicy(kind: RequestExecutionKind): RequestExecutionPolicy {
  switch (kind) {
    case "rpc":
      return {
        kind,
        visibility: "internal",
        access: "internal",
        mutation: "write",
        responseShape: "data",
        requiresTrustedOrigin: true,
        allowedContentTypes: [...RPC_ACCEPTED_CONTENT_TYPES],
      }
    case "action":
      return {
        kind,
        visibility: "public",
        access: "public",
        mutation: "write",
        responseShape: "data",
        requiresTrustedOrigin: true,
        allowedContentTypes: [
          "application/x-www-form-urlencoded",
          "multipart/form-data",
          "application/json",
        ],
      }
    case "partial":
      return {
        kind,
        visibility: "internal",
        access: "internal",
        mutation: "read",
        responseShape: "data",
        requiresTrustedOrigin: false,
      }
    case "route-handler":
      return {
        kind,
        visibility: "public",
        access: "public",
        mutation: "write",
        responseShape: "raw",
        requiresTrustedOrigin: true,
      }
    case "page":
    case "static":
      return {
        kind,
        visibility: "public",
        access: "public",
        mutation: "read",
        responseShape: kind === "static" ? "raw" : "document",
        requiresTrustedOrigin: false,
      }
  }
}

export function attachRequestMetadata(
  locals: Record<string, unknown>,
  metadata: RequestMetadata,
  policy: RequestExecutionPolicy = resolveRequestExecutionPolicy(metadata.kind),
): void {
  locals.requestKind = metadata.kind
  locals.requestVisibility = policy.visibility
  locals.requestPolicy = policy
  locals.requestAccess = policy.access
  locals.requestMutation = policy.mutation
  locals.requestResponseShape = policy.responseShape
  locals.requestHost = metadata.host
  locals.requestProtocol = metadata.protocol
  locals.requestOrigin = metadata.origin
  locals.requestEffectiveOrigin = metadata.effectiveOrigin
  locals.requestEffectiveHost = metadata.effectiveHost
  locals.requestEffectiveProto = metadata.effectiveProto
  locals.requestProxyTrusted = metadata.proxyTrusted
  locals.requestForwarded = metadata.forwarded
  locals.forwardedHost = metadata.forwardedHost
  locals.forwardedProto = metadata.forwardedProto
  locals.forwardedFor = metadata.forwardedFor
}

function defaultVisibilityForKind(kind: RequestExecutionKind): RequestVisibility {
  return kind === "partial" || kind === "rpc" ? "internal" : "public"
}

function isStateChangingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
}

function hasRequestBody(request: Request): boolean {
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  return contentLength > 0 || request.body !== null
}

function parseForwardedHeader(header: string | null, trustedHops = 1): { for?: string; host?: string; proto?: string } {
  if (!header) return {}
  const entries = splitHeaderList(header, ",")
  if (entries.length === 0) return {}
  const trustedEntry = entries[Math.max(0, entries.length - trustedHops)] ?? entries[entries.length - 1]
  if (!trustedEntry) return {}
  const result: { for?: string; host?: string; proto?: string } = {}
  for (const segment of splitHeaderList(trustedEntry, ";")) {
    const [rawKey, rawValue] = segment.split("=", 2)
    if (!rawKey || !rawValue) continue
    const key = rawKey.trim().toLowerCase()
    const value = normalizeForwardedValue(rawValue)
    if (!value) continue
    if (key === "for") result.for = normalizeForwardedFor(value)
    if (key === "host") result.host = normalizeForwardedHost(value)
    if (key === "proto") result.proto = normalizeForwardedProto(value)
  }
  return result
}

function getTrustedForwardedValue(header: string | null, trustedHops: number): string | undefined {
  if (!header) return undefined
  const values = splitHeaderList(header, ",")
  if (values.length === 0) return undefined
  return normalizeForwardedValue(values[Math.max(0, values.length - trustedHops)] ?? values[values.length - 1])
}

function splitHeaderList(input: string, separator: "," | ";"): string[] {
  const parts: string[] = []
  let current = ""
  let quoted = false
  for (const char of input) {
    if (char === "\"") quoted = !quoted
    if (char === separator && !quoted) {
      const trimmed = current.trim()
      if (trimmed) parts.push(trimmed)
      current = ""
      continue
    }
    current += char
  }
  const trimmed = current.trim()
  if (trimmed) parts.push(trimmed)
  return parts
}

function normalizeForwardedValue(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().replace(/^"|"$/g, "").trim()
  return normalized ? normalized : undefined
}

function normalizeForwardedHost(value: string | undefined): string | undefined {
  const normalized = normalizeForwardedValue(value)
  if (!normalized) return undefined
  if (/[/?#\s]/.test(normalized)) return undefined
  return normalized.toLowerCase()
}

function normalizeForwardedProto(value: string | undefined): string | undefined {
  const normalized = normalizeForwardedValue(value)?.replace(/:$/, "").toLowerCase()
  if (!normalized) return undefined
  return ["http", "https", "ws", "wss"].includes(normalized) ? normalized : undefined
}

function normalizeForwardedFor(value: string | undefined): string | undefined {
  const normalized = normalizeForwardedValue(value)
  if (!normalized) return undefined
  if (/[/?#\s]/.test(normalized)) return undefined
  return normalized
}
