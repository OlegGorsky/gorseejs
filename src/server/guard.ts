// Route guards — declarative access control for routes
// Usage: export const guard = requireRole("admin")

import type { Context, MiddlewareFn } from "./middleware.ts"

type GuardFn = (ctx: Context) => boolean | Promise<boolean>

interface GuardOptions {
  onFail?: (ctx: Context) => Response | Promise<Response>
}

const DEFAULT_DENY = (_ctx: Context) => new Response("Forbidden", { status: 403 })

/** Create a guard middleware from a predicate */
export function createGuard(check: GuardFn, options?: GuardOptions): MiddlewareFn {
  const onFail = options?.onFail ?? DEFAULT_DENY
  return async (ctx, next) => {
    const allowed = await check(ctx)
    if (!allowed) return onFail(ctx)
    return next()
  }
}

/** Guard: require authenticated session */
export function requireAuth(loginPath = "/login"): MiddlewareFn {
  return createGuard(
    (ctx) => !!ctx.locals.session,
    { onFail: (ctx) => ctx.redirect(loginPath) },
  )
}

/** Guard: require specific role (reads from session.data.role) */
export function requireRole(role: string, options?: GuardOptions): MiddlewareFn {
  return createGuard((ctx) => {
    const session = ctx.locals.session as { data?: { role?: string } } | undefined
    return session?.data?.role === role
  }, options)
}

/** Guard: combine multiple guards (all must pass) */
export function allGuards(...guards: MiddlewareFn[]): MiddlewareFn {
  return async (ctx, next) => {
    for (const guard of guards) {
      let passed = false
      const guardNext = async () => {
        passed = true
        return new Response(null)
      }
      const result = await guard(ctx, guardNext)
      if (!passed) return result
    }
    return next()
  }
}

/** Guard: any one guard passing is sufficient */
export function anyGuard(...guards: MiddlewareFn[]): MiddlewareFn {
  return async (ctx, next) => {
    for (const guard of guards) {
      let passed = false
      await guard(ctx, async () => {
        passed = true
        return new Response(null)
      })
      if (passed) return next()
    }
    return new Response("Forbidden", { status: 403 })
  }
}
