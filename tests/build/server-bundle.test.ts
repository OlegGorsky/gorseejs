import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { buildProject } from "../../src/cli/cmd-build.ts"

const TMP = join(process.cwd(), ".tmp-server-bundle-runtime")

describe("server bundle runtime", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())
    await writeFile(join(TMP, "routes", "index.tsx"), `
      export default function HomePage() {
        return <main>bundled runtime</main>
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("build emits Bun and Node production runtime entrypoints", async () => {
    await buildProject({ cwd: TMP })

    const prod = await import(pathToFileURL(join(TMP, "dist", "prod.js")).href)
    const prodNode = await import(pathToFileURL(join(TMP, "dist", "prod-node.js")).href)
    const serverHandler = await import(pathToFileURL(join(TMP, "dist", "server-handler.js")).href)
    const serverHandlerNode = await import(pathToFileURL(join(TMP, "dist", "server-handler-node.js")).href)

    expect(typeof prod.createProductionFetchHandler).toBe("function")
    expect(typeof prod.startProductionServer).toBe("function")
    expect(typeof prodNode.createProductionFetchHandler).toBe("function")
    expect(typeof prodNode.startNodeProductionServer).toBe("function")
    expect(typeof serverHandler.handleRequest).toBe("function")
    expect(typeof serverHandlerNode.handleRequest).toBe("function")

    const fetchHandler = await prod.createProductionFetchHandler({ cwd: TMP })
    const prodResponse = await fetchHandler(new Request("http://localhost/"))
    expect(prodResponse.status).toBe(200)
    expect(await prodResponse.text()).toContain("bundled runtime")

    const bundledResponse = await serverHandler.handleRequest(new Request("http://localhost/"))
    expect(bundledResponse.status).toBe(200)
    expect(await bundledResponse.text()).toContain("bundled runtime")

    const bundledNodeResponse = await serverHandlerNode.handleRequest(new Request("http://localhost/"))
    expect(bundledNodeResponse.status).toBe(200)
    expect(await bundledNodeResponse.text()).toContain("bundled runtime")

    const nodeServer = await prodNode.startNodeProductionServer({
      cwd: TMP,
      port: 0,
      registerSignalHandlers: false,
    })
    try {
      const nodeResponse = await fetch(`http://127.0.0.1:${nodeServer.port}/`)
      expect(nodeResponse.status).toBe(200)
      expect(await nodeResponse.text()).toContain("bundled runtime")
    } finally {
      await nodeServer.stop()
    }
  })
})
