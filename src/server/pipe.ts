// Middleware pipe — compose middleware functions into a pipeline
// Usage: pipe(cors(), compress(), rateLimit(), auth())
// Killer DX: declarative route-level middleware composition

import type { MiddlewareFn } from "./middleware.ts"

/** Compose multiple middleware into a single middleware function */
export function pipe(...middlewares: MiddlewareFn[]): MiddlewareFn {
  if (middlewares.length === 0) return async (_ctx, next) => next()
  if (middlewares.length === 1) return middlewares[0]!

  return async (ctx, next) => {
    let index = 0
    const run = async (): Promise<Response> => {
      if (index < middlewares.length) {
        const mw = middlewares[index]!
        index++
        return mw(ctx, run)
      }
      return next()
    }
    return run()
  }
}

/** Create a conditional middleware — runs inner only if predicate passes */
export function when(
  predicate: (ctx: import("./middleware.ts").Context) => boolean,
  middleware: MiddlewareFn,
): MiddlewareFn {
  return async (ctx, next) => {
    if (predicate(ctx)) return middleware(ctx, next)
    return next()
  }
}

/** Create a middleware that runs only for specific HTTP methods */
export function forMethods(methods: string[], middleware: MiddlewareFn): MiddlewareFn {
  const methodSet = new Set(methods.map((m) => m.toUpperCase()))
  return when((ctx) => methodSet.has(ctx.request.method), middleware)
}

/** Create a middleware that runs only for specific path prefixes */
export function forPaths(prefixes: string[], middleware: MiddlewareFn): MiddlewareFn {
  return when((ctx) => prefixes.some((p) => ctx.url.pathname.startsWith(p)), middleware)
}
