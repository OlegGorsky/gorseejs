export const PARTIAL_NAV_HEADER = "X-Gorsee-Navigate"
export const PARTIAL_NAV_VALUE = "partial"

export function isPartialNavigationRequest(request: Request): boolean {
  if (request.method !== "GET") return false
  if (request.headers.get(PARTIAL_NAV_HEADER) !== PARTIAL_NAV_VALUE) return false
  const accept = request.headers.get("Accept") ?? ""
  return accept.includes("application/json")
}

export function partialNavigationHeaders(
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Accept, X-Gorsee-Navigate",
    ...extraHeaders,
  }
}
