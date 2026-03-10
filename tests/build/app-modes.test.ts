import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildProject } from "../../src/cli/cmd-build.ts"
import { loadBuildManifest, loadReleaseArtifact } from "../../src/server/manifest.ts"

const TMP = join(process.cwd(), ".tmp-build-app-modes")
const FRONTEND_APP = join(TMP, "frontend")
const FRONTEND_WITH_API_APP = join(TMP, "frontend-with-api")
const SERVER_APP = join(TMP, "server")
const SERVER_WITH_UI_APP = join(TMP, "server-with-ui")

describe("build app modes", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })

    await mkdir(join(FRONTEND_APP, "routes"), { recursive: true })
    await writeFile(join(FRONTEND_APP, "app.config.ts"), `
      export default {
        app: {
          mode: "frontend",
        },
      }
    `.trim())
    await writeFile(join(FRONTEND_APP, "routes/index.tsx"), `
      export const prerender = true

      export default function HomePage() {
        return <main>frontend-only</main>
      }
    `.trim())

    await mkdir(join(FRONTEND_WITH_API_APP, "routes", "api"), { recursive: true })
    await writeFile(join(FRONTEND_WITH_API_APP, "app.config.ts"), `
      export default {
        app: {
          mode: "frontend",
        },
      }
    `.trim())
    await writeFile(join(FRONTEND_WITH_API_APP, "routes/index.tsx"), `
      export const prerender = true

      export default function HomePage() {
        return <main>frontend-with-api</main>
      }
    `.trim())
    await writeFile(join(FRONTEND_WITH_API_APP, "routes/api/health.ts"), `
      export function GET() {
        return Response.json({ status: "ok" })
      }
    `.trim())

    await mkdir(join(SERVER_APP, "routes", "api"), { recursive: true })
    await writeFile(join(SERVER_APP, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())
    await writeFile(join(SERVER_APP, "routes", "api", "health.ts"), `
      export function GET() {
        return Response.json({ status: "ok" })
      }
    `.trim())

    await mkdir(join(SERVER_WITH_UI_APP, "routes"), { recursive: true })
    await writeFile(join(SERVER_WITH_UI_APP, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())
    await writeFile(join(SERVER_WITH_UI_APP, "routes", "index.tsx"), `
      import { Link } from "gorsee/client"

      export default function Page() {
        return <Link href="/">home</Link>
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("frontend mode emits a frontend manifest without process server entries", async () => {
    await buildProject({ cwd: FRONTEND_APP })

    const manifest = await loadBuildManifest(join(FRONTEND_APP, "dist"))
    const release = await loadReleaseArtifact(join(FRONTEND_APP, "dist"))
    expect(manifest.appMode).toBe("frontend")
    expect(manifest.prerendered).toEqual(["/"])
    expect(release.appMode).toBe("frontend")
    expect(release.runtime.kind).toBe("frontend-static")
    expect(release.runtime.processEntrypoints).toEqual([])

    const distEntries = await readDirNames(join(FRONTEND_APP, "dist"))
    expect(distEntries).toContain("client")
    expect(distEntries).toContain("manifest.json")
    expect(distEntries).toContain("release.json")
    expect(distEntries).toContain("static")
    expect(distEntries).not.toContain("prod.js")
    expect(distEntries).not.toContain("prod-node.js")
  })

  test("server mode emits server artifacts without requiring client route entries", async () => {
    await buildProject({ cwd: SERVER_APP })

    const manifest = await loadBuildManifest(join(SERVER_APP, "dist"))
    const release = await loadReleaseArtifact(join(SERVER_APP, "dist"))
    expect(manifest.appMode).toBe("server")
    expect(Object.keys(manifest.routes)).toEqual(["/api/health"])
    expect(release.appMode).toBe("server")
    expect(release.runtime.kind).toBe("server-runtime")
    expect(release.runtime.workerEntrypoint).toBe("worker.js")

    const distEntries = await readDirNames(join(SERVER_APP, "dist"))
    expect(distEntries).toContain("prod.js")
    expect(distEntries).toContain("prod-node.js")
    expect(distEntries).toContain("server-handler.js")
    expect(distEntries).toContain("worker.js")
    expect(distEntries).toContain("release.json")
  })

  test("frontend mode fails closed when API routes are present", async () => {
    await expect(buildProject({ cwd: FRONTEND_WITH_API_APP })).rejects.toThrow("frontend mode does not allow API routes")
  })

  test("server mode fails closed when page/UI routes are present", async () => {
    await expect(buildProject({ cwd: SERVER_WITH_UI_APP })).rejects.toThrow("server mode does not allow page/UI route behavior")
  })
})

async function readDirNames(dir: string): Promise<string[]> {
  const entries = await readdir(dir)
  return entries.sort()
}
