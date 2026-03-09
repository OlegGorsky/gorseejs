import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildStaticMap, createRouter, matchRoute, type MatchResult } from "../../src/router/index.ts"
import { handlePageRequest } from "../../src/dev/request-handler.ts"
import { wrapHTML } from "../../src/server/html-shell.ts"
import { handleRPCWithHeaders } from "../../src/server/request-preflight.ts"
import { RPC_CONTENT_TYPE } from "../../src/server/rpc-protocol.ts"
import { __registerRPC, __resetRPCState } from "../../src/server/rpc.ts"
import { clearCache } from "../../src/server/cache.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"
import { runBuild } from "../../src/cli/cmd-build.ts"

const TMP = join(process.cwd(), ".tmp-dev-prod-cache-rpc-parity")
const ORIGINAL_CWD = process.cwd()

describe("dev/prod cache and rpc parity", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "https://app.example.com",
        },
      }
    `.trim())
    await writeFile(join(TMP, "routes", "_middleware.ts"), `
      import { routeCache } from "gorsee/server"

      export default routeCache({ maxAge: 60 })
    `.trim())
    await writeFile(join(TMP, "routes", "index.tsx"), `
      let counter = 0

      export async function loader() {
        counter += 1
        return { counter }
      }

      export default function HomePage(props: any) {
        return <main>counter:{props.data.counter}</main>
      }
    `.trim())
  })

  afterAll(async () => {
    process.chdir(ORIGINAL_CWD)
    __resetRPCState()
    await rm(TMP, { recursive: true, force: true })
  })

  test("cached document responses match between dev and prod while partial responses stay no-store", async () => {
    process.chdir(TMP)
    await runBuild([])
    const prodHandler = await createProductionFetchHandler({ cwd: TMP })
    const match = await getMatch("/")
    const clientBuild = { entryMap: new Map([["/", "index.js"]]) }

    await clearCache()
    const devPage1 = await handlePageRequest({
      match,
      request: new Request("https://app.example.com/"),
      nonce: "nonce-a",
      start: performance.now(),
      clientBuild,
      secHeaders: {},
      wrapHTML,
      trustedOrigin: "https://app.example.com",
    })
    await clearCache()
    const prodPage1 = await prodHandler(new Request("https://app.example.com/"))

    expect(devPage1.headers.get("X-Cache")).toBe("MISS")
    expect(prodPage1.headers.get("X-Cache")).toBe("MISS")
    const devPage1Text = await devPage1.text()
    const prodPage1Text = await prodPage1.text()
    const devPage1Counter = readCounterFromHTML(devPage1Text)
    const prodPage1Counter = readCounterFromHTML(prodPage1Text)
    expect(devPage1Counter).toBeGreaterThan(0)
    expect(prodPage1Counter).toBeGreaterThan(0)

    await clearCache()
    const devPage2 = await handlePageRequest({
      match,
      request: new Request("https://app.example.com/"),
      nonce: "nonce-b",
      start: performance.now(),
      clientBuild,
      secHeaders: {},
      wrapHTML,
      trustedOrigin: "https://app.example.com",
    })
    const devPage2b = await handlePageRequest({
      match,
      request: new Request("https://app.example.com/"),
      nonce: "nonce-b2",
      start: performance.now(),
      clientBuild,
      secHeaders: {},
      wrapHTML,
      trustedOrigin: "https://app.example.com",
    })
    await clearCache()
    const prodPage2 = await prodHandler(new Request("https://app.example.com/"))
    const prodPage2b = await prodHandler(new Request("https://app.example.com/"))

    expect(devPage2.headers.get("X-Cache")).toBe("MISS")
    expect(devPage2b.headers.get("X-Cache")).toBe("HIT")
    expect(prodPage2.headers.get("X-Cache")).toBe("MISS")
    expect(prodPage2b.headers.get("X-Cache")).toBe("HIT")
    expect(readCounterFromHTML(await devPage2.text())).toBe(readCounterFromHTML(await devPage2b.text()))
    expect(readCounterFromHTML(await prodPage2.text())).toBe(readCounterFromHTML(await prodPage2b.text()))

    const partialRequestInit = {
      headers: {
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
        Origin: "https://app.example.com",
      },
    } satisfies RequestInit

    await clearCache()
    const devPartial1 = await handlePageRequest({
      match,
      request: new Request("https://app.example.com/", partialRequestInit),
      nonce: "nonce-c",
      start: performance.now(),
      clientBuild,
      secHeaders: {},
      wrapHTML,
      trustedOrigin: "https://app.example.com",
    })
    await clearCache()
    const prodPartial1 = await prodHandler(new Request("https://app.example.com/", partialRequestInit))
    const devPartial2 = await handlePageRequest({
      match,
      request: new Request("https://app.example.com/", partialRequestInit),
      nonce: "nonce-c2",
      start: performance.now(),
      clientBuild,
      secHeaders: {},
      wrapHTML,
      trustedOrigin: "https://app.example.com",
    })
    await clearCache()
    const prodPartial2 = await prodHandler(new Request("https://app.example.com/", partialRequestInit))

    const devPayload1 = await devPartial1.json() as { data: { counter: number } }
    const prodPayload1 = await prodPartial1.json() as { data: { counter: number } }
    const devPayload2 = await devPartial2.json() as { data: { counter: number } }
    const prodPayload2 = await prodPartial2.json() as { data: { counter: number } }
    expect(devPartial1.headers.get("Cache-Control")).toBe("no-store")
    expect(prodPartial1.headers.get("Cache-Control")).toBe("no-store")
    expect(devPartial2.headers.get("Cache-Control")).toBe("no-store")
    expect(prodPartial2.headers.get("Cache-Control")).toBe("no-store")
    expect(devPartial1.headers.get("X-Cache")).toBeNull()
    expect(prodPartial1.headers.get("X-Cache")).toBeNull()
    expect(devPartial2.headers.get("X-Cache")).toBeNull()
    expect(prodPartial2.headers.get("X-Cache")).toBeNull()
    expect(devPayload2.data.counter).toBeGreaterThan(devPayload1.data.counter)
    expect(prodPayload2.data.counter).toBeGreaterThan(prodPayload1.data.counter)
  })

  test("rpc success envelope stays aligned between dev preflight and production runtime", async () => {
    __resetRPCState()
    __registerRPC("parityrpc001", async () => ({ ok: true }))

    process.chdir(TMP)
    await runBuild([])
    const prodHandler = await createProductionFetchHandler({ cwd: TMP })
    const requestInit = {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://app.example.com",
      },
    } satisfies RequestInit

    const devResponse = await handleRPCWithHeaders(new Request("https://app.example.com/api/_rpc/parityrpc001", requestInit), {}, {
      trustedOrigin: "https://app.example.com",
    })
    const prodResponse = await prodHandler(new Request("https://app.example.com/api/_rpc/parityrpc001", requestInit))

    expect(devResponse).not.toBeNull()
    expect(devResponse!.status).toBe(200)
    expect(prodResponse.status).toBe(200)
    expect(devResponse!.headers.get("Content-Type")).toBe(RPC_CONTENT_TYPE)
    expect(prodResponse.headers.get("Content-Type")).toBe(RPC_CONTENT_TYPE)
    await expect(devResponse!.json()).resolves.toEqual(await prodResponse.json())
  })
})

async function getMatch(pathname: string): Promise<MatchResult> {
  const routes = await createRouter(join(TMP, "routes"))
  const match = matchRoute(routes, pathname, buildStaticMap(routes))
  if (!match) throw new Error(`Route not found for ${pathname}`)
  return match
}

function readCounterFromHTML(html: string): number {
  const match = html.match(/counter:(\d+)/)
  if (!match) throw new Error("Counter not found in HTML response")
  return Number(match[1])
}
