// Built-in session-based auth with HMAC-signed cookies

import type { Context, MiddlewareFn } from "../server/middleware.ts"
import { verifySignedValue, signValue } from "./signing.ts"
export { createNamespacedSessionStore } from "./store-utils.ts"
export { createRedisSessionStore } from "./redis-session-store.ts"
export { createSQLiteSessionStore } from "./sqlite-session-store.ts"
export {
  createAuthActionTokenManager,
  createMemoryAuthActionTokenStore,
  type AuthActionTokenClaims,
  type AuthActionTokenPurpose,
  type AuthActionTokenReplayStore,
} from "./action-tokens.ts"

export interface AuthConfig {
  secret: string
  cookieName?: string
  maxAge?: number
  loginPath?: string
  store?: SessionStore
  events?: AuthEventHandler
  permissionResolver?: PermissionResolver
}

export interface Session {
  id: string
  userId: string
  data: Record<string, unknown>
  expiresAt: number
}

type Awaitable<T> = T | Promise<T>

export interface SessionStore {
  get(id: string): Awaitable<Session | undefined>
  set(id: string, session: Session): Awaitable<void>
  delete(id: string): Awaitable<void>
  entries(): Awaitable<Iterable<[string, Session]> | AsyncIterable<[string, Session]>>
}

export type AuthEvent =
  | {
    type: "login"
    sessionId: string
    userId: string
    expiresAt: number
  }
  | {
    type: "logout"
    sessionId: string
    userId: string
  }
  | {
    type: "rotate"
    previousSessionId: string
    sessionId: string
    userId: string
    expiresAt: number
  }
  | {
    type: "invalid-cookie"
    cookieName: string
  }
  | {
    type: "expired-session"
    sessionId: string
    userId: string
  }

export type AuthEventHandler = (event: AuthEvent) => Awaitable<void>
export type PermissionResolver = (session: Session, permission: string) => Awaitable<boolean>

function composeMiddlewares(...middlewares: MiddlewareFn[]): MiddlewareFn {
  return async (ctx, next) => {
    let index = -1

    const dispatch = async (position: number): Promise<Response> => {
      if (position <= index) throw new Error("Middleware chain re-entry is not allowed.")
      index = position
      const middleware = middlewares[position]
      if (!middleware) return next()
      return middleware(ctx, () => dispatch(position + 1))
    }

    return dispatch(0)
  }
}

export function createMemorySessionStore(): SessionStore {
  const sessions = new Map<string, Session>()
  return {
    get: (id) => sessions.get(id),
    set: (id, session) => { sessions.set(id, session) },
    delete: (id) => { sessions.delete(id) },
    entries: () => sessions.entries(),
  }
}

const defaultSessionStore = createMemorySessionStore()

async function pruneExpired(store: SessionStore): Promise<void> {
  const now = Date.now()
  const entries = await store.entries()
  for await (const [id, session] of entries) {
    if (session.expiresAt <= now) await store.delete(id)
  }
}

function resolveConfig(config: AuthConfig) {
  return {
    secret: config.secret,
    cookieName: config.cookieName ?? "gorsee_session",
    maxAge: config.maxAge ?? 86400,
    loginPath: config.loginPath ?? "/login",
    store: config.store ?? defaultSessionStore,
    events: config.events,
    permissionResolver: config.permissionResolver,
  }
}

function getSessionRole(session: Session | null): string | null {
  const role = session?.data?.role
  return typeof role === "string" ? role : null
}

function getSessionPermissions(session: Session | null): string[] {
  const permissions = session?.data?.permissions
  return Array.isArray(permissions) ? permissions.filter((value): value is string => typeof value === "string") : []
}

export function sessionHasRole(session: Session | null, role: string): boolean {
  return getSessionRole(session) === role
}

export async function sessionHasPermission(
  session: Session | null,
  permission: string,
  resolver?: PermissionResolver,
): Promise<boolean> {
  if (!session) return false
  if (getSessionPermissions(session).includes(permission)) return true
  if (!resolver) return false
  return resolver(session, permission)
}

export function createAuth(config: AuthConfig): {
  middleware: MiddlewareFn
  requireAuth: MiddlewareFn
  requireRole: (role: string) => MiddlewareFn
  requirePermission: (permission: string) => MiddlewareFn
  protect: (...middlewares: MiddlewareFn[]) => MiddlewareFn
  protectRole: (role: string, ...middlewares: MiddlewareFn[]) => MiddlewareFn
  protectPermission: (permission: string, ...middlewares: MiddlewareFn[]) => MiddlewareFn
  login: (ctx: Context, userId: string, data?: Record<string, unknown>) => Promise<void>
  rotateSession: (ctx: Context, data?: Record<string, unknown>) => Promise<void>
  logout: (ctx: Context) => Promise<void>
  getSession: (ctx: Context) => Session | null
  hasRole: (ctx: Context, role: string) => boolean
  hasPermission: (ctx: Context, permission: string) => Promise<boolean>
} {
  const cfg = resolveConfig(config)

  const middleware: MiddlewareFn = async (ctx, next) => {
      const cookie = ctx.cookies.get(cfg.cookieName)
    if (cookie) {
        const sessionId = await verifySignedValue(cookie, cfg.secret)
        if (sessionId) {
        const session = await cfg.store.get(sessionId)
        if (session && session.expiresAt > Date.now()) {
          ctx.locals.session = session
        } else if (session) {
          await cfg.store.delete(sessionId)
          await cfg.events?.({
            type: "expired-session",
            sessionId: session.id,
            userId: session.userId,
          })
        }
      } else {
        await cfg.events?.({ type: "invalid-cookie", cookieName: cfg.cookieName })
      }
    }
    return next()
  }

  const requireAuth: MiddlewareFn = async (ctx, next) => {
    if (!ctx.locals.session) {
      return ctx.redirect(cfg.loginPath)
    }
    return next()
  }

  const requireRole = (role: string): MiddlewareFn => async (ctx, next) => {
    if (!sessionHasRole(getSession(ctx), role)) {
      return new Response("Forbidden", { status: 403 })
    }
    return next()
  }

  const requirePermission = (permission: string): MiddlewareFn => async (ctx, next) => {
    if (!(await sessionHasPermission(getSession(ctx), permission, cfg.permissionResolver))) {
      return new Response("Forbidden", { status: 403 })
    }
    return next()
  }

  const protect = (...middlewares: MiddlewareFn[]): MiddlewareFn =>
    composeMiddlewares(middleware, requireAuth, ...middlewares)

  const protectRole = (role: string, ...middlewares: MiddlewareFn[]): MiddlewareFn =>
    protect(requireRole(role), ...middlewares)

  const protectPermission = (permission: string, ...middlewares: MiddlewareFn[]): MiddlewareFn =>
    protect(requirePermission(permission), ...middlewares)

  async function login(
    ctx: Context,
    userId: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    await pruneExpired(cfg.store)
    const id = crypto.randomUUID()
    const session: Session = {
      id,
      userId,
      data,
      expiresAt: Date.now() + cfg.maxAge * 1000,
    }
    await cfg.store.set(id, session)
    ctx.locals.session = session
    const signed = await signValue(id, cfg.secret)
    const isProduction = process.env.NODE_ENV === "production"
    ctx.setCookie(cfg.cookieName, signed, {
      maxAge: cfg.maxAge,
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      path: "/",
    })
    await cfg.events?.({
      type: "login",
      sessionId: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })
  }

  async function rotateSession(ctx: Context, data?: Record<string, unknown>): Promise<void> {
    const current = getSession(ctx)
    if (!current) {
      throw new Error("Cannot rotate session without an authenticated session.")
    }
    await cfg.store.delete(current.id)
    await pruneExpired(cfg.store)
    const nextSession: Session = {
      id: crypto.randomUUID(),
      userId: current.userId,
      data: data ?? current.data,
      expiresAt: Date.now() + cfg.maxAge * 1000,
    }
    await cfg.store.set(nextSession.id, nextSession)
    ctx.locals.session = nextSession
    const signed = await signValue(nextSession.id, cfg.secret)
    const isProduction = process.env.NODE_ENV === "production"
    ctx.setCookie(cfg.cookieName, signed, {
      maxAge: cfg.maxAge,
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      path: "/",
    })
    await cfg.events?.({
      type: "rotate",
      previousSessionId: current.id,
      sessionId: nextSession.id,
      userId: nextSession.userId,
      expiresAt: nextSession.expiresAt,
    })
  }

  async function logout(ctx: Context): Promise<void> {
    const session = ctx.locals.session as Session | undefined
    if (session) {
      await cfg.store.delete(session.id)
      ctx.locals.session = undefined
      await cfg.events?.({
        type: "logout",
        sessionId: session.id,
        userId: session.userId,
      })
    }
    ctx.deleteCookie(cfg.cookieName)
  }

  function getSession(ctx: Context): Session | null {
    return (ctx.locals.session as Session) ?? null
  }

  return {
    middleware,
    requireAuth,
    requireRole,
    requirePermission,
    protect,
    protectRole,
    protectPermission,
    login,
    rotateSession,
    logout,
    getSession,
    hasRole(ctx, role) {
      return sessionHasRole(getSession(ctx), role)
    },
    hasPermission(ctx, permission) {
      return sessionHasPermission(getSession(ctx), permission, cfg.permissionResolver)
    },
  }
}
