import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { runBuild } from "../../src/cli/cmd-build.ts"
import { clearCache } from "../../src/server/cache.ts"
import { createContext } from "../../src/server/middleware.ts"
import { __registerRPC, __resetRPCState } from "../../src/server/rpc.ts"
import { RPC_CONTENT_TYPE } from "../../src/server/rpc-protocol.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const ORIGINAL_CWD = process.cwd()
const ROOT = join(process.cwd(), ".tmp-canonical-recipes-runtime")
const SAAS = join(ROOT, "secure-saas")
const CONTENT = join(ROOT, "content-site")

describe("canonical recipes runtime", () => {
  beforeAll(async () => {
    await rm(ROOT, { recursive: true, force: true })
    await mkdir(join(SAAS, "routes", "app"), { recursive: true })
    await mkdir(join(CONTENT, "routes", "blog"), { recursive: true })

    await writeFile(join(SAAS, "app.config.ts"), `
      import { auth } from "./auth-shared"

      export default {
        security: {
          origin: "https://saas.example.com",
          rpc: {
            middlewares: [auth.middleware, auth.requireAuth],
          },
        },
      }
    `.trim())
    await writeFile(join(SAAS, "auth-shared.ts"), `
      import { createAuth, createMemorySessionStore } from "gorsee/server"

      const key = "__gorsee_recipe_saas_store__"
      const store = globalThis[key] ?? createMemorySessionStore()
      globalThis[key] = store

      export const auth = createAuth({
        secret: "recipe-saas-secret",
        store,
      })
    `.trim())
    await writeFile(join(SAAS, "routes", "_middleware.ts"), `
      export default async function rootMiddleware(ctx, next) {
        ctx.setHeader("X-Recipe", "secure-saas")
        return next()
      }
    `.trim())
    await writeFile(join(SAAS, "routes", "index.tsx"), `
      export default function HomePage() {
        return <main data-kind="marketing">welcome</main>
      }
    `.trim())
    await writeFile(join(SAAS, "routes", "app", "_middleware.ts"), `
      import { routeCache } from "gorsee/server"
      import { auth } from "../../auth-shared"

      const cache = routeCache({ maxAge: 60, mode: "private" })

      export default async function protectedMiddleware(ctx, next) {
        return auth.middleware(ctx, () => auth.requireAuth(ctx, () => cache(ctx, next)))
      }
    `.trim())
    await writeFile(join(SAAS, "routes", "app", "dashboard.tsx"), `
      let count = 0

      export async function loader(ctx: any) {
        count += 1
        return {
          user: ctx.locals.session?.userId ?? "guest",
          count,
        }
      }

      export default function DashboardPage(props: any) {
        return <main>dashboard:{props.data.user}:{props.data.count}</main>
      }
    `.trim())

    await writeFile(join(CONTENT, "app.config.ts"), `
      export default {
        security: {
          origin: "https://content.example.com",
        },
      }
    `.trim())
    await writeFile(join(CONTENT, "routes", "_middleware.ts"), `
      import { routeCache } from "gorsee/server"

      export default routeCache({
        maxAge: 120,
        mode: "public",
        includeAuthHeaders: false,
      })
    `.trim())
    await writeFile(join(CONTENT, "routes", "index.tsx"), `
      import { Head } from "gorsee/client"

      export const prerender = true

      export default function HomePage() {
        return (
          <>
            <Head><title>Content Home</title></Head>
            <main data-kind="content-home">content home</main>
          </>
        )
      }
    `.trim())
    await writeFile(join(CONTENT, "routes", "blog", "[slug].tsx"), `
      export async function loader(ctx: any) {
        return {
          slug: ctx.params.slug,
          title: "Public Article",
        }
      }

      export default function BlogPage(props: any) {
        return <article>article:{props.data.slug}:{props.data.title}</article>
      }
    `.trim())
  })

  afterAll(async () => {
    process.chdir(ORIGINAL_CWD)
    await clearCache()
    __resetRPCState()
    await rm(ROOT, { recursive: true, force: true })
  })

  test("secure saas recipe preserves protected routes, private cache, and rpc auth", async () => {
    __resetRPCState()
    __registerRPC("recipesaas01", async () => ({ ok: true }))

    process.chdir(SAAS)
    await runBuild([])

    const { auth } = await import(pathToFileURL(join(SAAS, "auth-shared.ts")).href) as {
      auth: { login: (ctx: ReturnType<typeof createContext>, userId: string) => Promise<void> }
    }
    const loginCtx = createContext(new Request("https://saas.example.com/login"))
    await auth.login(loginCtx, "user-1")
    const cookie = loginCtx.responseHeaders.get("Set-Cookie")!.split(";")[0]!

    const handler = await createProductionFetchHandler({ cwd: SAAS })

    const deniedPage = await handler(new Request("https://saas.example.com/app/dashboard"))
    expect(deniedPage.status).toBe(302)
    expect(deniedPage.headers.get("Location")).toBe("/login")

    await clearCache()
    const allowedPage1 = await handler(new Request("https://saas.example.com/app/dashboard", {
      headers: { Cookie: cookie },
    }))
    const allowedPage2 = await handler(new Request("https://saas.example.com/app/dashboard", {
      headers: { Cookie: cookie },
    }))
    expect(allowedPage1.status).toBe(200)
    expect(allowedPage1.headers.get("X-Recipe")).toBe("secure-saas")
    expect(allowedPage1.headers.get("X-Cache")).toBe("MISS")
    expect(allowedPage2.headers.get("X-Cache")).toBe("HIT")
    expect(allowedPage1.headers.get("Vary")).toContain("Cookie")
    expect(await allowedPage1.text()).toContain("dashboard:user-1:")

    const deniedRpc = await handler(new Request("https://saas.example.com/api/_rpc/recipesaas01", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://saas.example.com",
      },
    }))
    const allowedRpc = await handler(new Request("https://saas.example.com/api/_rpc/recipesaas01", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://saas.example.com",
        Cookie: cookie,
      },
    }))
    expect(deniedRpc.status).toBe(302)
    expect(allowedRpc.status).toBe(200)
  })

  test("content site recipe preserves prerendering and public cache semantics", async () => {
    process.chdir(CONTENT)
    await runBuild([])

    const handler = await createProductionFetchHandler({ cwd: CONTENT })

    const home = await handler(new Request("https://content.example.com/"))
    expect(home.status).toBe(200)
    expect(await home.text()).toContain("content home")

    await clearCache()
    const article1 = await handler(new Request("https://content.example.com/blog/launch", {
      headers: { Cookie: "sid=one" },
    }))
    const article2 = await handler(new Request("https://content.example.com/blog/launch", {
      headers: { Cookie: "sid=two" },
    }))
    expect(article1.status).toBe(200)
    expect(article1.headers.get("X-Cache")).toBe("MISS")
    expect(article2.headers.get("X-Cache")).toBe("HIT")
    expect(article1.headers.get("Vary")).not.toContain("Cookie")
    expect(await article2.text()).toContain("article:launch:Public Article")
  })
})
