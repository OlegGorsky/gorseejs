import type { RequestExecutionPolicy, RequestMetadata } from "./request-policy.ts"

export interface RequestSecurityPolicy {
  trustedOrigin?: string
  trustForwardedHeaders: boolean
  trustedForwardedHops: number
  trustedHosts: string[]
  enforceTrustedHosts: boolean
}

export interface RequestSecurityPolicyOptions {
  trustedOrigin?: string
  trustForwardedHeaders?: boolean
  trustedForwardedHops?: number
  trustedHosts?: string[]
  enforceTrustedHosts?: boolean
}

export function createRequestSecurityPolicy(
  options: RequestSecurityPolicyOptions = {},
): RequestSecurityPolicy {
  const trustedHosts = new Set<string>()
  const explicitTrustedHosts = options.trustedHosts ?? []
  for (const host of options.trustedHosts ?? []) {
    if (host.trim()) trustedHosts.add(normalizeHost(host))
  }
  if (options.trustedOrigin) {
    try {
      trustedHosts.add(normalizeHost(new URL(options.trustedOrigin).host))
    } catch {
      // Invalid origin will be handled by the caller's config validation path.
    }
  }
  return {
    trustedOrigin: options.trustedOrigin,
    trustForwardedHeaders: options.trustForwardedHeaders === true,
    trustedForwardedHops: options.trustForwardedHeaders === true
      ? Math.max(1, options.trustedForwardedHops ?? 1)
      : 0,
    trustedHosts: [...trustedHosts],
    enforceTrustedHosts: options.enforceTrustedHosts
      ?? (explicitTrustedHosts.length > 0
        || (options.trustForwardedHeaders === true && trustedHosts.size > 0)),
  }
}

export function validateRequestSecurityPolicy(
  metadata: RequestMetadata,
  executionPolicy: RequestExecutionPolicy,
  securityPolicy: RequestSecurityPolicy,
): Response | null {
  if (
    securityPolicy.enforceTrustedHosts &&
    securityPolicy.trustedHosts.length > 0 &&
    !securityPolicy.trustedHosts.includes(normalizeHost(metadata.effectiveHost))
  ) {
    return new Response("Invalid Host", { status: 400 })
  }

  if (
    executionPolicy.access === "internal" &&
    securityPolicy.trustedOrigin &&
    metadata.origin &&
    !sameOrigin(metadata.origin, securityPolicy.trustedOrigin)
  ) {
    return new Response("Forbidden", { status: 403 })
  }

  return null
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin
  } catch {
    return false
  }
}
