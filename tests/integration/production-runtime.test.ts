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
})
