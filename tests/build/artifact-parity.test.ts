import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { buildProject } from "../../src/cli/cmd-build.ts"
import { readBuildArtifactSurface } from "../../src/build/parity.ts"
import { BUILD_MANIFEST_SCHEMA_VERSION, loadBuildManifest } from "../../src/server/manifest.ts"

const TMP = join(process.cwd(), ".tmp-build-artifact-parity")
const BUN_APP = join(TMP, "bun-app")
const ROLLDOWN_APP = join(TMP, "rolldown-app")

describe("build artifact parity", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await createFixtureApp(BUN_APP)
    await createFixtureApp(ROLLDOWN_APP)
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("Bun and canonical Rolldown builds preserve manifest and artifact surface", async () => {
    await buildProject({ cwd: BUN_APP })
    await buildProject({ cwd: ROLLDOWN_APP, env: { ...process.env, GORSEE_BUILD_BACKEND: "rolldown" } })

    const bunSurface = await readBuildArtifactSurface(join(BUN_APP, "dist"))
    const rolldownSurface = await readBuildArtifactSurface(join(ROLLDOWN_APP, "dist"))

    expect(rolldownSurface.routes).toEqual(bunSurface.routes)
    expect(rolldownSurface.prerendered).toEqual(bunSurface.prerendered)
    expect(rolldownSurface.staticPages).toEqual(bunSurface.staticPages)
    expect(rolldownSurface.cssArtifacts).toHaveLength(bunSurface.cssArtifacts.length)
    expect(rolldownSurface.serverEntries).toEqual(bunSurface.serverEntries)
    expect(rolldownSurface.chunkCount).toBeLessThanOrEqual(bunSurface.chunkCount)
    expect(bunSurface.cssArtifacts.length).toBeGreaterThan(0)
    expect(bunSurface.serverEntries).toEqual(["prod-node.js", "prod.js", "server-handler-node.js", "server-handler.js", "worker.js"])

    const bunManifest = await loadBuildManifest(join(BUN_APP, "dist"))
    const rolldownManifest = await loadBuildManifest(join(ROLLDOWN_APP, "dist"))
    expect(bunManifest.schemaVersion).toBe(BUILD_MANIFEST_SCHEMA_VERSION)
    expect(rolldownManifest.schemaVersion).toBe(BUILD_MANIFEST_SCHEMA_VERSION)

    for (const route of ["/", "/about", "/counter", "/styled"]) {
      const bunBundle = bunManifest.routes[route]?.js
      const rolldownBundle = rolldownManifest.routes[route]?.js

      expect(bunBundle).toMatch(/\.js$/)
      expect(rolldownBundle).toMatch(/\.js$/)

      const bunSource = await readFile(join(BUN_APP, "dist", "client", bunBundle!), "utf8")
      const rolldownSource = await readFile(join(ROLLDOWN_APP, "dist", "client", rolldownBundle!), "utf8")

      expect(bunSource).toMatch(/document\.getElementById\((["'`])app\1\)/)
      expect(rolldownSource).toMatch(/document\.getElementById\((["'`])app\1\)/)
      expect(bunSource).toContain("window.__GORSEE_PARAMS__")
      expect(rolldownSource).toContain("window.__GORSEE_PARAMS__")
      expect(bunSource).not.toContain("return<>")
      expect(rolldownSource).not.toContain("return<>")
    }

    const bunCounter = await readFile(join(BUN_APP, "dist", "client", bunManifest.routes["/counter"]!.js!), "utf8")
    const rolldownCounter = await readFile(join(ROLLDOWN_APP, "dist", "client", rolldownManifest.routes["/counter"]!.js!), "utf8")

    expect(bunCounter).toContain("_rpc/")
    expect(rolldownCounter).toContain("_rpc/")
    expect(bunCounter).toContain("application/vnd.gorsee-rpc+json")
    expect(rolldownCounter).toContain("application/vnd.gorsee-rpc+json")
    expect(bunCounter).toContain("devalue")
    expect(rolldownCounter).toContain("devalue")
    expect(bunCounter).not.toContain("function loader")
    expect(rolldownCounter).not.toContain("function loader")

    const bunCss = await readFile(join(BUN_APP, "dist", "client", bunSurface.cssArtifacts[0]!), "utf8")
    const rolldownCss = await readFile(join(ROLLDOWN_APP, "dist", "client", rolldownSurface.cssArtifacts[0]!), "utf8")

    expect(bunCss).toContain(".styles_shell_")
    expect(rolldownCss).toContain(".styles_shell_")
    expect(bunCss).toContain("color: red")
    expect(rolldownCss).toContain("color: red")

    const bunServerHandler = await import(pathToFileURL(join(BUN_APP, "dist", "server-handler.js")).href)
    const rolldownServerHandler = await import(pathToFileURL(join(ROLLDOWN_APP, "dist", "server-handler.js")).href)
    expect(typeof bunServerHandler.handleRequest).toBe("function")
    expect(typeof rolldownServerHandler.handleRequest).toBe("function")

    const bunServerHandlerNode = await import(pathToFileURL(join(BUN_APP, "dist", "server-handler-node.js")).href)
    const rolldownServerHandlerNode = await import(pathToFileURL(join(ROLLDOWN_APP, "dist", "server-handler-node.js")).href)
    expect(typeof bunServerHandlerNode.handleRequest).toBe("function")
    expect(typeof rolldownServerHandlerNode.handleRequest).toBe("function")

    const bunWorker = await import(pathToFileURL(join(BUN_APP, "dist", "worker.js")).href)
    const rolldownWorker = await import(pathToFileURL(join(ROLLDOWN_APP, "dist", "worker.js")).href)
    expect(typeof bunWorker.default?.fetch).toBe("function")
    expect(typeof rolldownWorker.default?.fetch).toBe("function")

    const bunProdNode = await import(pathToFileURL(join(BUN_APP, "dist", "prod-node.js")).href)
    const rolldownProdNode = await import(pathToFileURL(join(ROLLDOWN_APP, "dist", "prod-node.js")).href)
    expect(typeof bunProdNode.startNodeProductionServer).toBe("function")
    expect(typeof bunProdNode.createProductionFetchHandler).toBe("function")
    expect(typeof rolldownProdNode.startNodeProductionServer).toBe("function")
    expect(typeof rolldownProdNode.createProductionFetchHandler).toBe("function")

    const bunProd = await import(pathToFileURL(join(BUN_APP, "dist", "prod.js")).href)
    const rolldownProd = await import(pathToFileURL(join(ROLLDOWN_APP, "dist", "prod.js")).href)
    expect(typeof bunProd.startProductionServer).toBe("function")
    expect(typeof bunProd.createProductionFetchHandler).toBe("function")
    expect(typeof rolldownProd.startProductionServer).toBe("function")
    expect(typeof rolldownProd.createProductionFetchHandler).toBe("function")
  })
})

async function createFixtureApp(root: string): Promise<void> {
  await mkdir(join(root, "routes"), { recursive: true })

  await writeFile(
    join(root, "routes", "index.tsx"),
    `
      import { createSignal } from "gorsee/client"

      export async function loader() {
        return { greeting: "hello" }
      }

      export default function Home() {
        const [count] = createSignal(1)
        return <main>{count()}</main>
      }
    `.trim(),
  )

  await writeFile(
    join(root, "routes", "about.tsx"),
    `
      export const prerender = true

      export default function About() {
        return <main>about prerendered</main>
      }
    `.trim(),
  )

  await writeFile(
    join(root, "routes", "counter.tsx"),
    `
      import { server } from "gorsee/server"

      const increment = server(async () => ({ next: 2 }))

      export async function loader() {
        return { count: 1 }
      }

      export default function CounterPage() {
        void increment()
        return <main>counter</main>
      }
    `.trim(),
  )

  await writeFile(join(root, "routes", "styles.module.css"), `.shell { color: red; }`)

  await writeFile(
    join(root, "routes", "styled.tsx"),
    `
      import styles from "./styles.module.css"

      export default function StyledPage() {
        return <main class={styles.shell}>styled</main>
      }
    `.trim(),
  )
}
