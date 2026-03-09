import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runBuild } from "../../src/cli/cmd-build.ts"
import { handlePageRequest } from "../../src/dev/request-handler.ts"
import { buildStaticMap, createRouter, matchRoute, type MatchResult } from "../../src/router/index.ts"
import { clearCache } from "../../src/server/cache.ts"
import { wrapHTML } from "../../src/server/html-shell.ts"
import { createContext } from "../../src/server/middleware.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const ORIGINAL_CWD = process.cwd()
const TMP = join(process.cwd(), ".tmp-dev-prod-auth-cache-parity")

describe("dev/prod auth-sensitive cache parity", () => {
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

    await writeFile(join(TMP, "auth-shared.ts"), `
      import { createAuth, createMemorySessionStore } from "gorsee/server"

      const store = createMemorySessionStore()
      export const auth = createAuth({
        secret: "parity-auth-secret",
        store,
      })
    `.trim())

    await writeFile(join(TMP, "routes", "_middleware.ts"), `
      import { routeCache } from "gorsee/server"
      import { auth } from "../auth-shared"

      const cache = routeCache({ maxAge: 60 })

      export default async function appMiddleware(ctx, next) {
        return auth.middleware(ctx, () => cache(ctx, next))
      }
    `.trim())

    await writeFile(join(TMP, "routes", "index.tsx"), `
      let renderCount = 0

      export async function loader(ctx) {
        renderCount += 1
        return {
          count: renderCount,
          viewer: ctx.locals.session?.userId ?? "guest",
        }
      }

      export default function HomePage(props) {
        return <main data-count={String(props.data.count)} data-viewer={props.data.viewer}>viewer:{props.data.viewer};count:{props.data.count}</main>
      }
    `.trim())
  })

  afterAll(async () => {
    process.chdir(ORIGINAL_CWD)
    await clearCache()
    await rm(TMP, { recursive: true, force: true })
  })

  test("document cache stays cookie-aware and partial responses stay uncached in both dev and prod", async () => {
    process.chdir(TMP)
    await runBuild([])

    const authCookie = await createSessionCookie()
    const prodHandler = await createProductionFetchHandler({ cwd: TMP })
    const match = await getMatch("/")
    const clientBuild = { entryMap: new Map([["/", "index.js"]]) }

    await clearCache()
    const devGuest1 = await requestDevDocument(match, clientBuild)
    const devGuest2 = await requestDevDocument(match, clientBuild)
    const devGuest1Html = await devGuest1.text()
    const devGuest2Html = await devGuest2.text()
    expect(devGuest1.headers.get("X-Cache")).toBe("MISS")
    expect(devGuest2.headers.get("X-Cache")).toBe("HIT")
    expect(devGuest1.headers.get("Vary")).toContain("Cookie")
    expect(readViewerFromHTML(devGuest1Html)).toBe("guest")
    expect(readViewerFromHTML(devGuest2Html)).toBe("guest")
    expect(readCountFromHTML(devGuest2Html)).toBe(readCountFromHTML(devGuest1Html))

    await clearCache()
    const devAuthed1 = await requestDevDocument(match, clientBuild, authCookie)
    const devAuthed2 = await requestDevDocument(match, clientBuild, authCookie)
    const devAuthed1Html = await devAuthed1.text()
    const devAuthed2Html = await devAuthed2.text()
    expect(devAuthed1.headers.get("X-Cache")).toBe("MISS")
    expect(devAuthed2.headers.get("X-Cache")).toBe("HIT")
    expect(readViewerFromHTML(devAuthed1Html)).toBe("user-1")
    expect(readViewerFromHTML(devAuthed2Html)).toBe("user-1")
    expect(readCountFromHTML(devAuthed2Html)).toBe(readCountFromHTML(devAuthed1Html))

    await clearCache()
    const prodGuest1 = await prodHandler(new Request("https://app.example.com/"))
    const prodGuest2 = await prodHandler(new Request("https://app.example.com/"))
    const prodGuest1Html = await prodGuest1.text()
    const prodGuest2Html = await prodGuest2.text()
    expect(prodGuest1.headers.get("X-Cache")).toBe("MISS")
    expect(prodGuest2.headers.get("X-Cache")).toBe("HIT")
    expect(prodGuest1.headers.get("Vary")).toContain("Cookie")
    expect(readViewerFromHTML(prodGuest1Html)).toBe("guest")
    expect(readViewerFromHTML(prodGuest2Html)).toBe("guest")
    expect(readCountFromHTML(prodGuest2Html)).toBe(readCountFromHTML(prodGuest1Html))

    await clearCache()
    const prodAuthed1 = await prodHandler(new Request("https://app.example.com/", {
      headers: { Cookie: authCookie },
    }))
    const prodAuthed2 = await prodHandler(new Request("https://app.example.com/", {
      headers: { Cookie: authCookie },
    }))
    const prodAuthed1Html = await prodAuthed1.text()
    const prodAuthed2Html = await prodAuthed2.text()
    expect(prodAuthed1.headers.get("X-Cache")).toBe("MISS")
    expect(prodAuthed2.headers.get("X-Cache")).toBe("HIT")
    expect(readViewerFromHTML(prodAuthed1Html)).toBe("user-1")
    expect(readViewerFromHTML(prodAuthed2Html)).toBe("user-1")
    expect(readCountFromHTML(prodAuthed2Html)).toBe(readCountFromHTML(prodAuthed1Html))

    await clearCache()
    const devPartial1 = await requestDevPartial(match, clientBuild, authCookie)
    const devPartial2 = await requestDevPartial(match, clientBuild, authCookie)
    const prodPartial1 = await prodHandler(createPartialRequest(authCookie))
    const prodPartial2 = await prodHandler(createPartialRequest(authCookie))
    const devPartialPayload1 = await devPartial1.json() as { data: { count: number; viewer: string } }
    const devPartialPayload2 = await devPartial2.json() as { data: { count: number; viewer: string } }
    const prodPartialPayload1 = await prodPartial1.json() as { data: { count: number; viewer: string } }
    const prodPartialPayload2 = await prodPartial2.json() as { data: { count: number; viewer: string } }

    expect(devPartial1.headers.get("Cache-Control")).toBe("no-store")
    expect(devPartial2.headers.get("Cache-Control")).toBe("no-store")
    expect(prodPartial1.headers.get("Cache-Control")).toBe("no-store")
    expect(prodPartial2.headers.get("Cache-Control")).toBe("no-store")
    expect(devPartial1.headers.get("X-Cache")).toBeNull()
    expect(devPartial2.headers.get("X-Cache")).toBeNull()
    expect(prodPartial1.headers.get("X-Cache")).toBeNull()
    expect(prodPartial2.headers.get("X-Cache")).toBeNull()
    expect(devPartialPayload1.data.viewer).toBe("user-1")
    expect(devPartialPayload2.data.viewer).toBe("user-1")
    expect(prodPartialPayload1.data.viewer).toBe("user-1")
    expect(prodPartialPayload2.data.viewer).toBe("user-1")
    expect(devPartialPayload2.data.count).toBeGreaterThan(devPartialPayload1.data.count)
    expect(prodPartialPayload2.data.count).toBeGreaterThan(prodPartialPayload1.data.count)
  })
})

async function getMatch(pathname: string): Promise<MatchResult> {
  const routes = await createRouter(join(TMP, "routes"))
  const match = matchRoute(routes, pathname, buildStaticMap(routes))
  if (!match) throw new Error(`Route not found for ${pathname}`)
  return match
}

async function createSessionCookie(): Promise<string> {
  const { auth } = await import(join(TMP, "auth-shared.ts")) as {
    auth: {
      login: (ctx: ReturnType<typeof createContext>, userId: string) => Promise<void>
    }
  }
  const ctx = createContext(new Request("https://app.example.com/login"))
  await auth.login(ctx, "user-1")
  return ctx.responseHeaders.get("Set-Cookie")!.split(";")[0]!
}

async function requestDevDocument(match: MatchResult, clientBuild: { entryMap: Map<string, string> }, cookie?: string): Promise<Response> {
  return handlePageRequest({
    match,
    request: new Request("https://app.example.com/", cookie ? { headers: { Cookie: cookie } } : undefined),
    nonce: "dev-doc",
    start: performance.now(),
    clientBuild,
    secHeaders: {},
    wrapHTML,
    trustedOrigin: "https://app.example.com",
  })
}

async function requestDevPartial(match: MatchResult, clientBuild: { entryMap: Map<string, string> }, cookie?: string): Promise<Response> {
  return handlePageRequest({
    match,
    request: createPartialRequest(cookie),
    nonce: "dev-partial",
    start: performance.now(),
    clientBuild,
    secHeaders: {},
    wrapHTML,
    trustedOrigin: "https://app.example.com",
  })
}

function createPartialRequest(cookie?: string): Request {
  const headers = new Headers({
    Accept: "application/json",
    "X-Gorsee-Navigate": "partial",
    Origin: "https://app.example.com",
  })
  if (cookie) headers.set("Cookie", cookie)
  return new Request("https://app.example.com/", { headers })
}

function readViewerFromHTML(html: string): string {
  const match = html.match(/viewer:([^;<]+);count:/)
  if (!match) throw new Error("Viewer not found in HTML response")
  return match[1]!
}

function readCountFromHTML(html: string): number {
  const match = html.match(/count:(\d+)/)
  if (!match) throw new Error("Count not found in HTML response")
  return Number(match[1])
}
