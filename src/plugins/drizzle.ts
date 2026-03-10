// Drizzle ORM integration plugin -- zero external dependencies

import type { MiddlewareFn, Context } from "../server/middleware.ts"
import type { GorseePlugin } from "./index.ts"
import { definePlugin } from "./index.ts"

export interface DrizzlePluginConfig {
  schema: string
  out: string
  dialect: "sqlite" | "postgres" | "mysql"
  connectionUrl?: string
}

interface DrizzleClosable {
  close(): void
}

let drizzleInstance: unknown = null

/** Returns the current drizzle instance (available after setup) */
export function getDrizzle<T = unknown>(): T {
  if (!drizzleInstance) {
    throw new Error("Drizzle not initialized. Did you register drizzlePlugin?")
  }
  return drizzleInstance as T
}

/** Middleware that attaches drizzle instance to ctx.locals.db */
export function drizzleMiddleware(instance: unknown): MiddlewareFn {
  return async (ctx: Context, next) => {
    ctx.locals.db = instance
    return next()
  }
}

/** Generates drizzle.config.ts content string */
export function generateDrizzleConfig(config: DrizzlePluginConfig): string {
  const dbCredentials =
    config.dialect === "sqlite"
      ? `{ url: "${config.connectionUrl ?? "./data.db"}" }`
      : `{ connectionString: "${config.connectionUrl ?? ""}" }`

  return `import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "${config.schema}",
  out: "${config.out}",
  dialect: "${config.dialect}",
  dbCredentials: ${dbCredentials},
})
`
}

function isDrizzleClosable(value: unknown): value is DrizzleClosable {
  return typeof value === "object" && value !== null && "close" in value
    && typeof value.close === "function"
}

/** Creates a Drizzle ORM integration plugin */
export function drizzlePlugin(config: DrizzlePluginConfig): GorseePlugin {
  return definePlugin({
    name: "gorsee-drizzle",
    capabilities: ["db"],

    async setup(app) {
      if (config.dialect === "sqlite") {
        const { Database } = await import("bun:sqlite" as string)
        const db = new Database(config.connectionUrl ?? "./data.db")
        db.exec("PRAGMA journal_mode=WAL")

        // Dynamic import for drizzle-orm/bun-sqlite
        try {
          const { drizzle } = await import("drizzle-orm/bun-sqlite" as string)
          drizzleInstance = drizzle(db)
        } catch {
          // If drizzle-orm not installed, store raw db
          drizzleInstance = db
        }
      } else {
        // For postgres/mysql, store connection URL for user to configure
        drizzleInstance = { dialect: config.dialect, url: config.connectionUrl }
      }

      app.addMiddleware(drizzleMiddleware(drizzleInstance))
    },

    async teardown() {
      if (isDrizzleClosable(drizzleInstance)) {
        drizzleInstance.close()
      }
      drizzleInstance = null
    },
  })
}
