import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runBuild } from "../../src/cli/cmd-build.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const TMP = join(process.cwd(), ".tmp-production-cache-runtime")
const ROUTES_DIR = join(TMP, "routes")

describe("production cache runtime integration", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(ROUTES_DIR, { recursive: true })

    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())

    await writeFile(join(ROUTES_DIR, "_middleware.ts"), `
      import { routeCache } from "gorsee/server"

      export default routeCache({ maxAge: 60 })
    `.trim())

    await writeFile(join(ROUTES_DIR, "index.tsx"), `
      let renderCount = 0

      export async function loader() {
        renderCount += 1
        return { count: renderCount }
      }

      export default function HomePage(props: any) {
        return <main data-count={String(props.data.count)}>count:{props.data.count}</main>
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("document and partial responses keep separate cache identity", async () => {
    process.chdir(TMP)
    await runBuild([])
    const handler = await createProductionFetchHandler({ cwd: TMP })

    const firstPage = await handler(new Request("http://localhost/"))
    const firstPageHtml = await firstPage.text()
    expect(firstPage.status).toBe(200)
    expect(firstPage.headers.get("X-Cache")).toBe("MISS")
    expect(firstPage.headers.get("Vary")).toContain("Accept")
    expect(firstPage.headers.get("Vary")).toContain("X-Gorsee-Navigate")
    expect(firstPageHtml).toContain("count:1")

    const secondPage = await handler(new Request("http://localhost/"))
    const secondPageHtml = await secondPage.text()
    expect(secondPage.headers.get("X-Cache")).toBe("HIT")
    expect(secondPageHtml).toContain("count:1")

    const firstPartial = await handler(new Request("http://localhost/", {
      headers: {
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    }))
    const firstPartialPayload = await firstPartial.json() as { html: string; data: { count: number } }
    expect(firstPartial.status).toBe(200)
    expect(firstPartial.headers.get("X-Cache")).toBeNull()
    expect(firstPartial.headers.get("Cache-Control")).toBe("no-store")
    expect(firstPartialPayload.data.count).toBe(2)
    expect(firstPartialPayload.html).toContain("count:2")

    const secondPartial = await handler(new Request("http://localhost/", {
      headers: {
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    }))
    const secondPartialPayload = await secondPartial.json() as { html: string; data: { count: number } }
    expect(secondPartial.headers.get("X-Cache")).toBeNull()
    expect(secondPartial.headers.get("Cache-Control")).toBe("no-store")
    expect(secondPartialPayload.data.count).toBe(3)
  })

  test("default private cache varies by cookie to avoid auth-sensitive collisions", async () => {
    process.chdir(TMP)
    await runBuild([])
    const handler = await createProductionFetchHandler({ cwd: TMP })

    const first = await handler(new Request("http://localhost/", {
      headers: {
        Cookie: "sid=one",
      },
    }))
    const firstHtml = await first.text()
    expect(first.headers.get("X-Cache")).toBe("MISS")

    const second = await handler(new Request("http://localhost/", {
      headers: {
        Cookie: "sid=two",
      },
    }))
    const secondHtml = await second.text()
    expect(second.headers.get("X-Cache")).toBe("MISS")
    expect(second.headers.get("Vary")).toContain("Cookie")
    expect(firstHtml).not.toBe(secondHtml)
  })
})
