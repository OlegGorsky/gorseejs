import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildProject } from "../../src/cli/cmd-build.ts"
import { BUILD_MANIFEST_SCHEMA_VERSION, loadBuildManifest } from "../../src/server/manifest.ts"

const TMP = join(process.cwd(), ".tmp-rolldown-runtime-contract")

describe("rolldown runtime contract", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes", "users"), { recursive: true })
    await writeFile(join(TMP, "app.config.ts"), `export default { security: { origin: "http://localhost" } }\n`)
    await writeFile(
      join(TMP, "routes", "index.tsx"),
      `export default function Home(){ return <main>home</main> }\n`,
    )
    await writeFile(
      join(TMP, "routes", "users", "index.tsx"),
      `export async function loader(){ return { ok: true } }\nexport default function Users(){ return <main>users</main> }\n`,
    )
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("canonical rolldown output keeps nested entry paths, transpiled jsx, and canonical runtime chunk names", async () => {
    await buildProject({ cwd: TMP, env: { ...process.env, GORSEE_BUILD_BACKEND: "rolldown" } })

    const manifest = await loadBuildManifest(join(TMP, "dist"))
    expect(manifest.schemaVersion).toBe(BUILD_MANIFEST_SCHEMA_VERSION)
    expect(manifest.routes["/"]?.js).toMatch(/^index\..+\.js$/)
    expect(manifest.routes["/users"]?.js).toMatch(/^users\/index\..+\.js$/)

    const rootBundle = await readFile(join(TMP, "dist", "client", manifest.routes["/"]!.js!), "utf8")
    const usersBundle = await readFile(join(TMP, "dist", "client", manifest.routes["/users"]!.js!), "utf8")
    const runtimeChunk = await readFile(join(TMP, "dist", "client", "chunks", "runtime.js"), "utf8")

    expect(rootBundle).toMatch(/from["']\.\/chunks\/runtime\.js["']/)
    expect(usersBundle).toMatch(/from["']\.\.\/chunks\/runtime\.js["']/)
    expect(rootBundle).not.toContain("jsxDEV_")
    expect(rootBundle).not.toContain("Fragment_")
    expect(usersBundle).not.toContain("function loader")
    expect(runtimeChunk).toContain("window.addEventListener")
    expect(runtimeChunk).toContain("document.createElement")
  })
})
