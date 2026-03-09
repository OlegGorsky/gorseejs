import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { runBuild } from "../../src/cli/cmd-build.ts"
import { createContext } from "../../src/server/middleware.ts"
import { __registerRPC, __resetRPCState } from "../../src/server/rpc.ts"
import { RPC_CONTENT_TYPE, RPC_PROTOCOL_VERSION } from "../../src/server/rpc-protocol.ts"
import { clearCache } from "../../src/server/cache.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const ORIGINAL_CWD = process.cwd()
const TMP = join(process.cwd(), ".tmp-production-large-app-runtime")
const ROUTES_DIR = join(TMP, "routes")

describe("production large-app runtime integration", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(ROUTES_DIR, "(app)"), { recursive: true })

    await writeFile(join(TMP, "app.config.ts"), `
      import { auth } from "./auth-shared"

      export default {
        security: {
          origin: "https://app.example.com",
          rpc: {
            middlewares: [auth.middleware, auth.requireAuth],
          },
        },
      }
    `.trim())

    await writeFile(join(TMP, "auth-shared.ts"), `
      import { createAuth, createMemorySessionStore } from "gorsee/server"

      const globalStoreKey = "__gorsee_large_app_store__"
      const store = globalThis[globalStoreKey] ?? createMemorySessionStore()
      globalThis[globalStoreKey] = store
      export const auth = createAuth({
        secret: "large-app-secret",
        store,
      })
    `.trim())

    await writeFile(join(ROUTES_DIR, "_middleware.ts"), `
      export default async function rootMiddleware(ctx, next) {
        ctx.setHeader("X-Root-Middleware", "true")
        return next()
      }
    `.trim())

    await writeFile(join(ROUTES_DIR, "index.tsx"), `
      export default function LoginPage() {
        return <main data-kind="public-home">login page</main>
      }
    `.trim())

    await writeFile(join(ROUTES_DIR, "(app)", "_layout.tsx"), `
      export default function AppLayout(props: { children: unknown }) {
        return <section data-shell="app-shell">{props.children}</section>
      }
    `.trim())

    await writeFile(join(ROUTES_DIR, "(app)", "_middleware.ts"), `
      import { routeCache } from "gorsee/server"
      import { auth } from "../../auth-shared"

      const cache = routeCache({ maxAge: 60 })

      export default async function appMiddleware(ctx, next) {
        return auth.middleware(ctx, () => auth.requireAuth(ctx, () => cache(ctx, next)))
      }
    `.trim())

    await writeFile(join(ROUTES_DIR, "(app)", "dashboard.tsx"), `
      let renderCount = 0

      export async function loader(ctx: any) {
        renderCount += 1
        return {
          count: renderCount,
          user: ctx.locals.session?.userId ?? "guest",
        }
      }

      export default function DashboardPage(props: any) {
        return <main data-user={props.data.user} data-count={String(props.data.count)}>dashboard:{props.data.user}:{props.data.count}</main>
      }
    `.trim())
  })

  afterAll(async () => {
    process.chdir(ORIGINAL_CWD)
    await clearCache()
    __resetRPCState()
    await rm(TMP, { recursive: true, force: true })
  })

  test("grouped auth routes preserve layout, private cache, partial semantics, and rpc policy", async () => {
    __resetRPCState()
    __registerRPC("largeapprpc01", async () => ({ ok: true, scope: "large-app" }))

    process.chdir(TMP)
    await runBuild([])
    const { auth } = await import(pathToFileURL(join(TMP, "auth-shared.ts")).href) as {
      auth: {
        login: (ctx: ReturnType<typeof createContext>, userId: string) => Promise<void>
      }
    }
    const loginCtx = createContext(new Request("https://app.example.com/login"))
    await auth.login(loginCtx, "user-1")
    const sessionCookie = loginCtx.responseHeaders.get("Set-Cookie")!.split(";")[0]!
    const handler = await createProductionFetchHandler({ cwd: TMP })

    await clearCache()
    const deniedDashboard = await handler(new Request("https://app.example.com/dashboard"))
    expect(deniedDashboard.status).toBe(302)
    expect(deniedDashboard.headers.get("Location")).toBe("/login")

    await clearCache()
    const dashboard1 = await handler(new Request("https://app.example.com/dashboard", {
      headers: { Cookie: sessionCookie },
    }))
    const dashboard2 = await handler(new Request("https://app.example.com/dashboard", {
      headers: { Cookie: sessionCookie },
    }))
    const dashboard1Html = await dashboard1.text()
    const dashboard2Html = await dashboard2.text()

    expect(dashboard1.status).toBe(200)
    expect(dashboard1.headers.get("X-Cache")).toBe("MISS")
    expect(dashboard2.headers.get("X-Cache")).toBe("HIT")
    expect(dashboard1.headers.get("Vary")).toContain("Cookie")
    expect(dashboard1Html).toContain('data-shell="app-shell"')
    expect(readDashboardUser(dashboard1Html)).toBe("user-1")
    expect(readDashboardUser(dashboard2Html)).toBe("user-1")
    expect(readDashboardCount(dashboard2Html)).toBe(readDashboardCount(dashboard1Html))

    const partialRequest = {
      headers: {
        Cookie: sessionCookie,
        Accept: "application/json",
        Origin: "https://app.example.com",
        "X-Gorsee-Navigate": "partial",
      },
    } satisfies RequestInit

    const partial1 = await handler(new Request("https://app.example.com/dashboard", partialRequest))
    const partial2 = await handler(new Request("https://app.example.com/dashboard", partialRequest))
    const partialPayload1 = await partial1.json() as { data: { count: number; user: string }; html: string }
    const partialPayload2 = await partial2.json() as { data: { count: number; user: string }; html: string }

    expect(partial1.status).toBe(200)
    expect(partial2.status).toBe(200)
    expect(partial1.headers.get("Cache-Control")).toBe("no-store")
    expect(partial2.headers.get("Cache-Control")).toBe("no-store")
    expect(partial1.headers.get("X-Cache")).toBeNull()
    expect(partial2.headers.get("X-Cache")).toBeNull()
    expect(partialPayload1.data.user).toBe("user-1")
    expect(partialPayload2.data.user).toBe("user-1")
    expect(partialPayload1.html).toContain("dashboard:user-1:")
    expect(partialPayload2.data.count).toBeGreaterThan(partialPayload1.data.count)

    const deniedRpc = await handler(new Request("https://app.example.com/api/_rpc/largeapprpc01", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://app.example.com",
      },
    }))
    expect(deniedRpc.status).toBe(302)
    expect(deniedRpc.headers.get("Location")).toBe("/login")

    const allowedRpc = await handler(new Request("https://app.example.com/api/_rpc/largeapprpc01", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://app.example.com",
        Cookie: sessionCookie,
      },
    }))
    expect(allowedRpc.status).toBe(200)
    expect(allowedRpc.headers.get("Content-Type")).toBe(RPC_CONTENT_TYPE)
    await expect(allowedRpc.json()).resolves.toEqual({
      v: RPC_PROTOCOL_VERSION,
      ok: true,
      encoding: "devalue",
      data: expect.any(String),
    })
  })
})

function readDashboardUser(html: string): string {
  const match = html.match(/dashboard:([^:]+):\d+/)
  if (!match) throw new Error("Dashboard user not found in HTML response")
  return match[1]!
}

function readDashboardCount(html: string): number {
  const match = html.match(/dashboard:[^:]+:(\d+)/)
  if (!match) throw new Error("Dashboard count not found in HTML response")
  return Number(match[1])
}
