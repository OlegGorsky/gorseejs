import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildProject } from "../../src/cli/cmd-build.ts"
import { readBuildArtifactSurface } from "../../src/build/parity.ts"
import { getClientBundleForRoute, loadBuildManifest } from "../../src/server/manifest.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const TMP = join(process.cwd(), ".tmp-production-backend-parity")
const BUN_APP = join(TMP, "bun-app")
const ROLLDOWN_APP = join(TMP, "rolldown-app")

describe("production backend parity", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await createFixtureApp(BUN_APP)
    await createFixtureApp(ROLLDOWN_APP)
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("Bun and canonical Rolldown builds preserve production runtime surface", async () => {
    await buildProject({ cwd: BUN_APP })
    await buildProject({
      cwd: ROLLDOWN_APP,
      env: { ...process.env, GORSEE_BUILD_BACKEND: "rolldown" },
    })

    const bunSurface = await readBuildArtifactSurface(join(BUN_APP, "dist"))
    const rolldownSurface = await readBuildArtifactSurface(join(ROLLDOWN_APP, "dist"))
    expect(rolldownSurface.routes).toEqual(bunSurface.routes)
    expect(rolldownSurface.prerendered).toEqual(bunSurface.prerendered)
    expect(rolldownSurface.staticPages).toEqual(bunSurface.staticPages)
    expect(rolldownSurface.cssArtifacts).toHaveLength(bunSurface.cssArtifacts.length)

    const bunManifest = await loadBuildManifest(join(BUN_APP, "dist"))
    const rolldownManifest = await loadBuildManifest(join(ROLLDOWN_APP, "dist"))
    const bunFetch = await createProductionFetchHandler({ cwd: BUN_APP })
    const rolldownFetch = await createProductionFetchHandler({ cwd: ROLLDOWN_APP })

    await assertResponseParity(await bunFetch(new Request("http://localhost/")), await rolldownFetch(new Request("http://localhost/")), [
      "<title>Built Home</title>",
      "<main data-kind=\"home\">hello prerender</main>",
    ])

    await assertResponseParity(
      await bunFetch(new Request("http://localhost/about")),
      await rolldownFetch(new Request("http://localhost/about")),
      [
        "<title>Built About</title>",
        "<main data-kind=\"about\">hello runtime</main>",
      ],
    )

    await assertResponseParity(
      await bunFetch(new Request("http://localhost/styled")),
      await rolldownFetch(new Request("http://localhost/styled")),
      [
        "<title>Built Styled</title>",
        "data-kind=\"styled\"",
      ],
    )

    const bunRobots = await bunFetch(new Request("http://localhost/robots.txt"))
    const rolldownRobots = await rolldownFetch(new Request("http://localhost/robots.txt"))
    expect(bunRobots.status).toBe(200)
    expect(rolldownRobots.status).toBe(200)
    expect(await bunRobots.text()).toBe(await rolldownRobots.text())

    const bunAboutBundle = getClientBundleForRoute(bunManifest, "/about")
    const rolldownAboutBundle = getClientBundleForRoute(rolldownManifest, "/about")
    expect(bunAboutBundle).toMatch(/\.js$/)
    expect(rolldownAboutBundle).toMatch(/\.js$/)

    const bunAsset = await bunFetch(new Request(`http://localhost/_gorsee/${bunAboutBundle}`))
    const rolldownAsset = await rolldownFetch(new Request(`http://localhost/_gorsee/${rolldownAboutBundle}`))
    expect(bunAsset.status).toBe(200)
    expect(rolldownAsset.status).toBe(200)
    expect(bunAsset.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")
    expect(rolldownAsset.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")
    expect(bunAsset.headers.get("Content-Type")).toContain("application/javascript")
    expect(rolldownAsset.headers.get("Content-Type")).toContain("application/javascript")

    const bunAssetSource = await bunAsset.text()
    const rolldownAssetSource = await rolldownAsset.text()
    expect(bunAssetSource).toContain("window.__GORSEE_PARAMS__")
    expect(rolldownAssetSource).toContain("window.__GORSEE_PARAMS__")
  })
})

async function assertResponseParity(bunResponse: Response, rolldownResponse: Response, markers: string[]): Promise<void> {
  const bunHtml = await bunResponse.text()
  const rolldownHtml = await rolldownResponse.text()

  expect(bunResponse.status).toBe(200)
  expect(rolldownResponse.status).toBe(200)
  expect(bunResponse.headers.get("Content-Security-Policy")).toContain("script-src")
  expect(rolldownResponse.headers.get("Content-Security-Policy")).toContain("script-src")

  for (const marker of markers) {
    expect(bunHtml).toContain(marker)
    expect(rolldownHtml).toContain(marker)
  }
}

async function createFixtureApp(root: string): Promise<void> {
  const routesDir = join(root, "routes")
  const publicDir = join(root, "public")
  await mkdir(routesDir, { recursive: true })
  await mkdir(publicDir, { recursive: true })

  await writeFile(join(root, "app.config.ts"), `
    export default {
      security: {
        origin: "http://localhost",
      },
    }
  `.trim())

  await writeFile(join(routesDir, "index.tsx"), `
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

  await writeFile(join(routesDir, "about.tsx"), `
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

  await writeFile(join(routesDir, "styled.module.css"), `.shell { color: red; }`)

  await writeFile(join(routesDir, "styled.tsx"), `
    import { Head } from "gorsee/client"
    import styles from "./styled.module.css"

    export default function StyledPage() {
      return (
        <>
          <Head><title>Built Styled</title></Head>
          <main data-kind="styled" class={styles.shell}>styled</main>
        </>
      )
    }
  `.trim())

  await writeFile(join(publicDir, "robots.txt"), "User-agent: *\\nAllow: /\\n")
}
