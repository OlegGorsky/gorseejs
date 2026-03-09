export interface SecurityConfig {
  csp: boolean
  hsts: boolean
  csrf: boolean
  rateLimit: { requests: number; window: string } | false
  nonce?: string
}

const DEFAULT_CONFIG: SecurityConfig = {
  csp: true,
  hsts: true,
  csrf: true,
  rateLimit: { requests: 100, window: "1m" },
}

export function securityHeaders(
  config: Partial<SecurityConfig> = {},
  nonce?: string
): Record<string, string> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const headers: Record<string, string> = {}

  if (cfg.csp) {
    const scriptSrc = nonce ? `'nonce-${nonce}'` : "'self'"
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  }

  if (cfg.hsts) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
  }

  // Always set these
  headers["X-Content-Type-Options"] = "nosniff"
  headers["X-Frame-Options"] = "DENY"
  headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
  headers["X-XSS-Protection"] = "0" // Modern browsers: CSP is better
  headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

  return headers
}
