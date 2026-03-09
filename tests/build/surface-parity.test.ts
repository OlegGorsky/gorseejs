import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRouter } from "../../src/router/scanner.ts"
import { buildStaticMap, matchRoute } from "../../src/router/matcher.ts"
import { createBuildManifest } from "../../src/build/manifest.ts"
import { createRuntimeRequestPlan } from "../../src/server/request-surface.ts"

const TMP = join(process.cwd(), ".tmp-surface-parity")

describe("scanner/matcher/manifest/request-surface parity", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "docs"), { recursive: true })

    await writeFile(join(TMP, "index.tsx"), `
      export async function loader() { return { ok: true } }
      export default function Home() { return <main>home</main> }
    `.trim())

    await writeFile(join(TMP, "docs", "[slug].tsx"), `
      export default function DocPage() { return <main>doc</main> }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("matched routes produce route surfaces and aligned manifest entries", async () => {
    const routes = await createRouter(TMP)
    const staticMap = buildStaticMap(routes)
    const match = matchRoute(routes, "/docs/security", staticMap)
    const manifest = await createBuildManifest(
      routes,
      new Map([
        ["/", "index.js"],
        ["/docs/[slug]", "docs-slug.js"],
      ]),
      new Map([
        ["index.js", "index.123.js"],
        ["docs-slug.js", "docs-slug.456.js"],
      ]),
    )

    expect(match?.route.path).toBe("/docs/[slug]")
    expect(manifest.routes["/docs/[slug]"]?.js).toBe("docs-slug.456.js")
    expect(manifest.routes["/docs/[slug]"]?.hasLoader).toBe(false)

    const plan = createRuntimeRequestPlan({
      pathname: "/docs/security",
      hasRouteMatch: Boolean(match),
      allowPrerendered: true,
    })

    expect(plan).toEqual(["static", "prerendered", "route", "not-found"])
  })

  test("unmatched paths never claim route handling in runtime plan", async () => {
    const routes = await createRouter(TMP)
    const staticMap = buildStaticMap(routes)
    const match = matchRoute(routes, "/does-not-exist", staticMap)

    expect(match).toBeNull()
    expect(createRuntimeRequestPlan({
      pathname: "/does-not-exist",
      hasRouteMatch: false,
      allowPrerendered: true,
    })).toEqual(["static", "prerendered", "not-found"])
  })
})
