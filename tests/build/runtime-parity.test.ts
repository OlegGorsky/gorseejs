import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRouter } from "../../src/router/scanner.ts"
import { buildStaticMap, matchRoute } from "../../src/router/matcher.ts"
import { createBuildManifest } from "../../src/build/manifest.ts"

const TMP = join(process.cwd(), ".tmp-runtime-parity")

describe("scanner/matcher/manifest parity", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "users"), { recursive: true })
    await writeFile(join(TMP, "index.tsx"), `
      export async function loader() { return { ok: true } }
      export default function Home() { return <main>home</main> }
    `.trim())
    await writeFile(join(TMP, "users", "[id].tsx"), `
      export default function UserPage() { return <main>user</main> }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("matched routes and build manifest stay aligned on loader metadata and entries", async () => {
    const routes = await createRouter(TMP)
    const staticMap = buildStaticMap(routes)
    const manifest = await createBuildManifest(
      routes,
      new Map([
        ["/", "index.js"],
        ["/users/[id]", "users-id.js"],
      ]),
      new Map([
        ["index.js", "index.123.js"],
        ["users-id.js", "users-id.456.js"],
      ]),
    )

    const home = matchRoute(routes, "/", staticMap)
    const user = matchRoute(routes, "/users/42", staticMap)

    expect(home?.route.path).toBe("/")
    expect(user?.route.path).toBe("/users/[id]")
    expect(manifest.routes["/"]?.hasLoader).toBe(true)
    expect(manifest.routes["/users/[id]"]?.hasLoader).toBe(false)
    expect(manifest.routes["/"]?.js).toBe("index.123.js")
    expect(manifest.routes["/users/[id]"]?.js).toBe("users-id.456.js")
  })
})
