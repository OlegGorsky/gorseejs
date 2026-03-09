// CSRF protection using Signed Double-Submit Cookie pattern
// Works for both SSR (token in HTML) and SPA (cookie-based)

import { timingSafeEqual } from "node:crypto"
import type { MiddlewareFn } from "../server/middleware.ts"

const CSRF_COOKIE = "__gorsee_csrf"
const CSRF_HEADER = "x-gorsee-csrf"
const TOKEN_LENGTH = 32

function randomBytes(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

async function hmacSign(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(token)
  )
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("")
}

export function generateCSRFToken(): string {
  return randomBytes(TOKEN_LENGTH)
}

export async function validateCSRFToken(
  request: Request,
  secret: string
): Promise<boolean> {
  // Skip safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true

  const cookieHeader = request.headers.get("cookie") ?? ""
  const headerToken = request.headers.get(CSRF_HEADER) ?? ""

  // Parse cookie
  let cookieToken = ""
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.trim().split("=")
    if (key === CSRF_COOKIE) {
      cookieToken = rest.join("=")
      break
    }
  }

  if (!cookieToken || !headerToken) return false

  // Verify: cookie contains "token.signature", header contains "token"
  const [token, signature] = cookieToken.split(".")
  if (!token || !signature) return false

  // Header must match token part of cookie
  if (headerToken !== token) return false

  // Verify HMAC signature (timing-safe comparison)
  const expectedSig = await hmacSign(token, secret)
  if (signature.length !== expectedSig.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
}

export async function csrfProtection(secret: string): Promise<{
  token: string
  cookie: string
  headerName: string
}> {
  const token = generateCSRFToken()
  const signature = await hmacSign(token, secret)
  const cookieValue = `${token}.${signature}`

  return {
    token,
    cookie: `${CSRF_COOKIE}=${cookieValue}; Path=/; SameSite=Lax; Secure`,
    headerName: CSRF_HEADER,
  }
}

export function createCSRFMiddleware(secret: string): MiddlewareFn {
  return async (ctx, next) => {
    const valid = await validateCSRFToken(ctx.request, secret)
    if (!valid) {
      return new Response("Invalid CSRF token", { status: 403 })
    }
    return next()
  }
}
