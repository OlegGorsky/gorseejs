import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runBuild } from "../../src/cli/cmd-build.ts"
import { getClientBundleForRoute, loadBuildManifest } from "../../src/server/manifest.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const TMP = join(process.cwd(), ".tmp-production-runtime")
const ROUTES_DIR = join(TMP, "routes")
const PUBLIC_DIR = join(TMP, "public")

describe("production runtime integration", () => {
  const originalCwd = process.cwd()

  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(ROUTES_DIR, { recursive: true })
    await mkdir(PUBLIC_DIR, { recursive: true })
    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())

    await writeFile(join(ROUTES_DIR, "index.tsx"), `
      import { Head } from "gorsee/client"

      export const prerender = true

      export default function HomePage() {
        return (
          <>
            <Head><title>Built Home</title></Head>
            <main data-kind="home">hello prerender</main>
          </>
        )
      }
    `.trim())

    await writeFile(join(ROUTES_DIR, "about.tsx"), `
      import { Head } from "gorsee/client"

      export async function loader() {
        return { message: "hello runtime" }
      }

      export default function AboutPage(props: any) {
        return (
          <>
            <Head><title>Built About</title></Head>
            <main data-kind="about">{props.data.message}</main>
          </>
        )
      }
    `.trim())

    await writeFile(join(PUBLIC_DIR, "robots.txt"), "User-agent: *\nAllow: /\n")
  })

  afterAll(async () => {
    process.chdir(originalCwd)
    await rm(TMP, { recursive: true, force: true })
  })

  test("real build and production server serve prerendered, SSR, and static content", async () => {
    process.chdir(TMP)
    await runBuild([])

    const manifest = await loadBuildManifest(join(TMP, "dist"))
    expect(manifest.routes["/"]?.prerendered).toBe(true)
    expect(manifest.routes["/about"]?.hasLoader).toBe(true)

    const fetchHandler = await createProductionFetchHandler({ cwd: TMP })

    const home = await fetchHandler(new Request("http://localhost/"))
    const homeHtml = await home.text()
    expect(home.status).toBe(200)
    expect(home.headers.get("Content-Security-Policy")).toContain("script-src")
    expect(homeHtml).toContain("<title>Built Home</title>")
    expect(homeHtml).toContain("<main data-kind=\"home\">hello prerender</main>")

    const about = await fetchHandler(new Request("http://localhost/about"))
    const aboutHtml = await about.text()
    expect(about.status).toBe(200)
    expect(about.headers.get("Content-Security-Policy")).toContain("script-src")
    expect(aboutHtml).toContain("<title>Built About</title>")
    expect(aboutHtml).toContain("<main data-kind=\"about\">hello runtime</main>")

    const robots = await fetchHandler(new Request("http://localhost/robots.txt"))
    expect(robots.status).toBe(200)
    expect(robots.headers.get("Content-Security-Policy")).toContain("script-src")
    expect(await robots.text()).toContain("User-agent: *")

    const aboutClientBundle = getClientBundleForRoute(manifest, "/about")
    expect(aboutClientBundle).toBeTruthy()
    const asset = await fetchHandler(new Request(`http://localhost/_gorsee/${aboutClientBundle}`))
    expect(asset.status).toBe(200)
    expect(asset.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")
    expect(asset.headers.get("Content-Type")).toContain("application/javascript")
  })

  test("production runtime fails closed when trusted origin is missing", async () => {
    await rm(join(TMP, "app.config.ts"), { force: true })

    await expect(createProductionFetchHandler({ cwd: TMP, env: {} as NodeJS.ProcessEnv })).rejects.toThrow(
      "Missing trusted origin for production runtime",
    )

    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())
  })

  test("production runtime accepts APP_ORIGIN env fallback when app config origin is absent", async () => {
    await writeFile(join(TMP, "app.config.ts"), `export default {}\n`)

    process.chdir(TMP)
    await runBuild([])

    const fetchHandler = await createProductionFetchHandler({
      cwd: TMP,
      env: { APP_ORIGIN: "http://localhost" } as NodeJS.ProcessEnv,
    })

    const response = await fetchHandler(new Request("http://localhost/about"))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("<main data-kind=\"about\">hello runtime</main>")
  })

  test("production runtime fails closed in multi-instance mode without a distributed rate limiter", async () => {
    const appRoot = join(TMP, "multi-instance-fail")
    await seedProductionApp(appRoot)
    await writeFile(join(appRoot, "app.config.ts"), `
      export default {
        runtime: {
          topology: "multi-instance",
        },
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())

    process.chdir(appRoot)
    await runBuild([])

    await expect(createProductionFetchHandler({ cwd: appRoot })).rejects.toThrow(
      "Multi-instance production runtime requires security.rateLimit.limiter in app.config.ts.",
    )
  })

  test("production runtime accepts an explicit distributed rate limiter in multi-instance mode", async () => {
    ;(globalThis as Record<string, unknown>).__gorsee_test_rate_limit_client__ = createFakeRateLimitClient()
    const appRoot = join(TMP, "multi-instance-redis")
    await seedProductionApp(appRoot)
    await writeFile(join(appRoot, "app.config.ts"), `
      import { createNodeRedisLikeClient, createRedisRateLimiter } from "gorsee/server"

      const client = createNodeRedisLikeClient(globalThis.__gorsee_test_rate_limit_client__)

      export default {
        runtime: {
          topology: "multi-instance",
        },
        security: {
          origin: "http://localhost",
          rateLimit: {
            limiter: createRedisRateLimiter(client, 2, "1m", { prefix: "test:runtime:rate-limit" }),
          },
        },
      }
    `.trim())

    process.chdir(appRoot)
    await runBuild([])

    const fetchHandler = await createProductionFetchHandler({ cwd: appRoot })
    const server = {
      requestIP() {
        return { address: "127.0.0.1" }
      },
    }

    expect((await fetchHandler(new Request("http://localhost/about"), server)).status).toBe(200)
    expect((await fetchHandler(new Request("http://localhost/about"), server)).status).toBe(200)
    const blocked = await fetchHandler(new Request("http://localhost/about"), server)

    expect(blocked.status).toBe(429)
    expect(blocked.headers.get("Retry-After")).toBeTruthy()
  })
})

async function seedProductionApp(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true })
  await mkdir(join(root, "routes"), { recursive: true })
  await mkdir(join(root, "public"), { recursive: true })
  await writeFile(join(root, "routes", "index.tsx"), `
    export default function HomePage() {
      return <main data-kind="home">hello</main>
    }
  `.trim())
  await writeFile(join(root, "routes", "about.tsx"), `
    export async function loader() {
      return { message: "hello runtime" }
    }

    export default function AboutPage(props: any) {
      return <main data-kind="about">{props.data.message}</main>
    }
  `.trim())
}

function createFakeRateLimitClient() {
  const store = new Map<string, string>()
  const expiresAt = new Map<string, number>()

  const prune = (key: string) => {
    const expiry = expiresAt.get(key)
    if (expiry === undefined || expiry > Date.now()) return
    store.delete(key)
    expiresAt.delete(key)
  }

  return {
    async get(key: string) {
      prune(key)
      return store.get(key) ?? null
    },
    async set(key: string, value: string) {
      store.set(key, value)
    },
    async del(key: string) {
      const existed = store.delete(key)
      expiresAt.delete(key)
      return existed ? 1 : 0
    },
    async keys(pattern: string) {
      const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
      return [...store.keys()].filter((key) => key.startsWith(prefix))
    },
    async incr(key: string) {
      prune(key)
      const next = Number(store.get(key) ?? "0") + 1
      store.set(key, String(next))
      return next
    },
    async expire(key: string, seconds: number) {
      if (!store.has(key)) return 0
      expiresAt.set(key, Date.now() + seconds * 1000)
      return 1
    },
    async pttl(key: string) {
      prune(key)
      const expiry = expiresAt.get(key)
      if (expiry === undefined) return -1
      return Math.max(0, expiry - Date.now())
    },
  }
}
