// Lucia auth adapter plugin -- session management integration

import type { MiddlewareFn, Context } from "../server/middleware.ts"
import type { GorseePlugin } from "./index.ts"
import { definePlugin } from "./index.ts"

export interface LuciaPluginConfig {
  adapter: "sqlite" | "prisma" | "drizzle"
  sessionTable?: string
  userTable?: string
}

interface LuciaInstance {
  validateSession(sessionId: string): Promise<{ session: unknown; user: unknown } | null>
  createSession(userId: string, attributes?: Record<string, unknown>): Promise<{ id: string }>
  invalidateSession(sessionId: string): Promise<void>
}

let luciaInstance: LuciaInstance | null = null

/** Returns the Lucia instance (available after setup) */
export function getLucia(): LuciaInstance {
  if (!luciaInstance) {
    throw new Error("Lucia not initialized. Did you register luciaPlugin?")
  }
  return luciaInstance
}

/** Extracts current session from context (set by middleware) */
export function getSession(ctx: Context): unknown | null {
  return ctx.locals.session ?? null
}

/** Extracts current user from context (set by middleware) */
export function getUser(ctx: Context): unknown | null {
  return ctx.locals.user ?? null
}

/** Creates the session validation middleware */
function createSessionMiddleware(): MiddlewareFn {
  return async (ctx: Context, next) => {
    ctx.locals.session = null
    ctx.locals.user = null

    const sessionId =
      ctx.cookies.get("auth_session") ??
      ctx.request.headers.get("Authorization")?.replace("Bearer ", "") ??
      null

    if (sessionId && luciaInstance) {
      try {
        const result = await luciaInstance.validateSession(sessionId)
        if (result) {
          ctx.locals.session = result.session
          ctx.locals.user = result.user
        }
      } catch {
        // Invalid session -- continue without auth
      }
    }

    return next()
  }
}

/** Creates a Lucia auth integration plugin */
export function luciaPlugin(config: LuciaPluginConfig): GorseePlugin {
  return definePlugin({
    name: "gorsee-lucia",
    capabilities: ["auth"],

    async setup() {
      try {
        const { Lucia } = await import("lucia" as string)
        let adapter: unknown

        if (config.adapter === "sqlite") {
          const { BunSQLiteAdapter } = await import("@lucia-auth/adapter-sqlite" as string)
          const { Database } = await import("bun:sqlite" as string)
          const db = new Database("./data.db")
          adapter = new BunSQLiteAdapter(db, {
            session: config.sessionTable ?? "session",
            user: config.userTable ?? "user",
          })
        } else if (config.adapter === "prisma") {
          const { PrismaAdapter } = await import("@lucia-auth/adapter-prisma" as string)
          const { PrismaClient } = await import("@prisma/client" as string)
          adapter = new PrismaAdapter(new PrismaClient(), {
            session: config.sessionTable ?? "session",
            user: config.userTable ?? "user",
          })
        } else {
          // Drizzle adapter -- user must configure separately
          adapter = null
        }

        if (adapter) {
          luciaInstance = new Lucia(adapter) as unknown as LuciaInstance
        }
      } catch {
        // Lucia not installed -- instance stays null
        luciaInstance = null
      }
    },

    middleware: createSessionMiddleware(),

    async teardown() {
      luciaInstance = null
    },
  })
}
