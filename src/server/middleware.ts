// Server context, middleware chain, and cookie management

export interface CookieOptions {
  maxAge?: number
  expires?: Date
  path?: string
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: "Strict" | "Lax" | "None"
}

export interface Context {
  request: Request
  url: URL
  params: Record<string, string>
  cookies: Map<string, string>
  locals: Record<string, unknown>
  /** Response headers to be merged into the final response */
  responseHeaders: Headers
  redirect(url: string, status?: number): Response
  setCookie(name: string, value: string, options?: CookieOptions): void
  deleteCookie(name: string, options?: Pick<CookieOptions, "path" | "domain">): void
  setHeader(name: string, value: string): void
}

export interface ContextOptions {
  trustedOrigin?: string
}

export type NextFn = () => Promise<Response>
export type MiddlewareFn = (ctx: Context, next: NextFn) => Promise<Response>

/** Throwable redirect — use in loaders to interrupt and redirect */
export class RedirectError {
  constructor(public url: string, public status: number = 302) {}
}

export function redirect(url: string, status = 302): never {
  throw new RedirectError(url, status)
}

export function sanitizeRedirectTarget(target: string, currentUrlOrOrigin: URL | string): string {
  const currentUrl = typeof currentUrlOrOrigin === "string"
    ? new URL(currentUrlOrOrigin)
    : currentUrlOrOrigin

  if (target.startsWith("//")) return "/"
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(target)) return target

  try {
    const targetUrl = new URL(target)
    return targetUrl.origin === currentUrl.origin ? target : "/"
  } catch {
    return "/"
  }
}

export function isAllowedRequestOrigin(request: Request, trustedOrigin?: string): boolean {
  const origin = request.headers.get("Origin")
  if (!origin) return true
  try {
    const requestOrigin = new URL(origin)
    const expectedOrigin = new URL(trustedOrigin ?? new URL(request.url).origin)
    return requestOrigin.origin === expectedOrigin.origin
  } catch {
    return false
  }
}

export function middleware(fn: MiddlewareFn): MiddlewareFn {
  return fn
}

function sanitizeCookiePart(str: string): string {
  return str.replace(/[\r\n;,]/g, "")
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let cookie = `${sanitizeCookiePart(name)}=${sanitizeCookiePart(value)}`
  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`
  if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`
  cookie += `; Path=${options.path ?? "/"}`
  if (options.domain) cookie += `; Domain=${options.domain}`
  if (options.secure) cookie += "; Secure"
  if (options.httpOnly) cookie += "; HttpOnly"
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`
  return cookie
}

function parseCookies(request: Request): Map<string, string> {
  const cookieHeader = request.headers.get("cookie") ?? ""
  const cookies = new Map<string, string>()
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.trim().split("=")
    if (key) cookies.set(key, rest.join("="))
  }
  return cookies
}

export function createContext(
  request: Request,
  params: Record<string, string> = {},
  options: ContextOptions = {},
): Context {
  const url = new URL(request.url)
  const trustedOrigin = options.trustedOrigin
  const cookies = parseCookies(request)
  const responseHeaders = new Headers()
  const pendingCookies: string[] = []

  return {
    request,
    url,
    params,
    cookies,
    locals: {},
    responseHeaders,

    redirect(target: string, status = 302) {
      const safeTarget = sanitizeRedirectTarget(target, trustedOrigin ?? url)
      const res = new Response(null, {
        status,
        headers: { Location: safeTarget },
      })
      // Apply pending cookies to redirect response
      for (const cookie of pendingCookies) {
        res.headers.append("Set-Cookie", cookie)
      }
      return res
    },

    setCookie(name: string, value: string, options?: CookieOptions) {
      const cookie = serializeCookie(name, value, options)
      pendingCookies.push(cookie)
      responseHeaders.append("Set-Cookie", cookie)
      cookies.set(name, value)
    },

    deleteCookie(name: string, options?: Pick<CookieOptions, "path" | "domain">) {
      const cookie = serializeCookie(name, "", {
        ...options,
        maxAge: 0,
        expires: new Date(0),
      })
      pendingCookies.push(cookie)
      responseHeaders.append("Set-Cookie", cookie)
      cookies.delete(name)
    },

    setHeader(name: string, value: string) {
      responseHeaders.set(name, value)
    },
  }
}

export async function runMiddlewareChain(
  middlewares: MiddlewareFn[],
  ctx: Context,
  handler: () => Promise<Response>
): Promise<Response> {
  let index = 0

  const next = async (): Promise<Response> => {
    if (index < middlewares.length) {
      const mw = middlewares[index]!
      index++
      return mw(ctx, next)
    }
    return handler()
  }

  const response = await next()

  // Merge ctx.responseHeaders into response
  for (const [key, value] of ctx.responseHeaders.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      response.headers.append(key, value)
    } else {
      response.headers.set(key, value)
    }
  }

  return response
}
