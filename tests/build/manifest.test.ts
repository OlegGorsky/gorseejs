import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRouter } from "../../src/router/scanner.ts"
import { createBuildManifest } from "../../src/build/manifest.ts"
import { inspectRouteBuildMetadata } from "../../src/build/route-metadata.ts"
import { inspectRouteFacts, ROUTE_FACTS_SCHEMA_VERSION } from "../../src/compiler/route-facts.ts"
import { BUILD_MANIFEST_SCHEMA_VERSION } from "../../src/server/manifest.ts"

const TMP = join(process.cwd(), ".tmp-manifest")

describe("build manifest", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })

    await writeFile(join(TMP, "index.tsx"), `
      export async function loader() {
        return { ok: true }
      }
      export const prerender = true
      export default function Home() {
        return <main>home</main>
      }
    `.trim())

    await writeFile(join(TMP, "about.tsx"), `
      export default function About() {
        return <main>about</main>
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("captures hashed client entry, loader flag, and prerendered flag", async () => {
    const routes = await createRouter(TMP)
    const entryMap = new Map<string, string>([
      ["/", "index.js"],
      ["/about", "about.js"],
    ])
    const hashMap = new Map<string, string>([
      ["index.js", "index.1234.js"],
      ["about.js", "about.5678.js"],
      ["chunk-x.js", "chunk-x.abcd.js"],
    ])

    const manifest = await createBuildManifest(routes, entryMap, hashMap, ["/"])

    expect(manifest.schemaVersion).toBe(BUILD_MANIFEST_SCHEMA_VERSION)
    expect(manifest.routes["/"]).toEqual({
      js: "index.1234.js",
      hasLoader: true,
      prerendered: true,
    })
    expect(manifest.routes["/about"]).toEqual({
      js: "about.5678.js",
      hasLoader: false,
      prerendered: undefined,
    })
    expect(manifest.prerendered).toEqual(["/"])
    expect(manifest.chunks).toContain("chunk-x.abcd.js")
  })

  test("route metadata uses shared analysis facts for loader and prerender flags", async () => {
    const routes = await createRouter(TMP)
    const home = routes.find((route) => route.path === "/")
    const about = routes.find((route) => route.path === "/about")

    expect(home).toBeDefined()
    expect(about).toBeDefined()

    await expect(inspectRouteBuildMetadata(home!)).resolves.toEqual({
      hasLoader: true,
      declaresPrerender: true,
    })
    await expect(inspectRouteBuildMetadata(about!)).resolves.toEqual({
      hasLoader: false,
      declaresPrerender: false,
    })
  })

  test("route facts expose versioned compiler schema", async () => {
    const routes = await createRouter(TMP)
    const home = routes.find((route) => route.path === "/")

    expect(home).toBeDefined()

    await expect(inspectRouteFacts(home!)).resolves.toMatchObject({
      schemaVersion: ROUTE_FACTS_SCHEMA_VERSION,
      path: "/",
      hasLoader: true,
      declaresPrerender: true,
      hasMiddleware: false,
    })
  })
})
