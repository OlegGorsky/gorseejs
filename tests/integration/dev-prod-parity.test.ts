import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildStaticMap, createRouter, matchRoute, type MatchResult } from "../../src/router/index.ts"
import { handlePageRequest } from "../../src/dev/request-handler.ts"
import { handlePartialNavigation } from "../../src/dev/partial-handler.ts"
import { wrapHTML } from "../../src/server/html-shell.ts"
import { renderNotFoundPage } from "../../src/server/not-found.ts"
import { partialNavigationHeaders } from "../../src/server/partial-navigation.ts"
import { handleRouteRequest } from "../../src/server/route-request.ts"
import {
  buildPartialResponsePayload,
  createClientScriptPath,
  renderPageDocument,
} from "../../src/server/page-render.ts"

const TMP = join(process.cwd(), ".tmp-dev-prod-parity")

describe("dev/prod parity", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })

    const files: Record<string, string> = {
      "index.tsx": `
        import { Head } from "gorsee/client"

        export async function loader() {
          return { message: "hello parity" }
        }

        export default function Page(props: any) {
          return (
            <>
              <Head>
                <title>Parity Page</title>
              </Head>
              <main data-kind="page">{props.data.message}</main>
            </>
          )
        }
      `,
      "redirect.tsx": `
        import { redirect } from "gorsee/server"

        export async function loader() {
          redirect("/login", 307)
        }

        export default function RedirectPage() {
          return <main>redirect</main>
        }
      `,
      "404.tsx": `
        import { Head } from "gorsee/client"

        export default function NotFoundPage() {
          return (
            <>
              <Head>
                <title>Custom Missing</title>
              </Head>
              <main data-kind="not-found">Custom 404</main>
            </>
          )
        }
      `,
    }

    for (const [file, content] of Object.entries(files)) {
      await writeFile(join(TMP, file), content.trim())
    }
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("custom 404 route is rendered in both dev and prod shells", async () => {
    const nonce = "test-nonce"
    const devHtml = await renderNotFoundPage(TMP, nonce, {
      bodyPrefix: ['<script nonce="test-nonce">window.__DEV__=1</script>'],
      bodySuffix: ['<script nonce="test-nonce">window.__HMR__=1</script>'],
    })
    const prodHtml = await renderNotFoundPage(TMP, nonce)

    expect(devHtml).toContain("<main data-kind=\"not-found\">Custom 404</main>")
    expect(prodHtml).toContain("<main data-kind=\"not-found\">Custom 404</main>")
    expect(devHtml).toContain("<title>404 - Not Found</title>")
    expect(prodHtml).toContain("<title>404 - Not Found</title>")
  })

  test("full SSR keeps title, loader data, and client script aligned", async () => {
    const match = await getMatch("/")
    const request = new Request("http://localhost/")
    const nonce = "ssr-nonce"
    const clientBuild = { entryMap: new Map([["/", "index.js"]]) }

    const devResponse = await handlePageRequest({
      match,
      request,
      nonce,
      start: performance.now(),
      clientBuild,
      secHeaders: {},
      wrapHTML,
    })

    const prodResponse = await handleProductionRoute({
      match,
      request,
      nonce,
      manifestJs: "index.js",
    })

    const devHtml = await devResponse.text()
    const prodHtml = await prodResponse.text()

    expect(devResponse.status).toBe(200)
    expect(prodResponse.status).toBe(200)
    expect(devHtml).toBe(prodHtml)
    expect(devHtml).toContain("<title>Parity Page</title>")
    expect(devHtml).toContain("<main data-kind=\"page\">hello parity</main>")
    expect(devHtml).toContain("\"message\":\"hello parity\"")
    expect(devHtml).toContain("src=\"/_gorsee/index.js\"")
  })

  test("partial navigation payload matches between dev and prod", async () => {
    const match = await getMatch("/")
    const request = new Request("http://localhost/", {
      headers: {
        "Accept": "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    })
    const clientBuild = { entryMap: new Map([["/", "index.js"]]) }

    const devResponse = await handlePartialNavigation({ match, request, clientBuild })
    const prodResponse = await handleProductionRoute({
      match,
      request,
      nonce: "partial-nonce",
      manifestJs: "index.js",
    })

    expect(devResponse.status).toBe(200)
    expect(prodResponse.status).toBe(200)
    expect(devResponse.headers.get("Cache-Control")).toBe("no-store")
    expect(prodResponse.headers.get("Cache-Control")).toBe("no-store")
    expect(devResponse.headers.get("Vary")).toContain("X-Gorsee-Navigate")
    expect(prodResponse.headers.get("Vary")).toContain("X-Gorsee-Navigate")
    expect(await devResponse.json()).toEqual(await prodResponse.json())
  })

  test("loader redirects resolve to the same response contract", async () => {
    const match = await getMatch("/redirect")
    const request = new Request("http://localhost/redirect")
    const clientBuild = { entryMap: new Map<string, string>() }

    const devResponse = await handlePageRequest({
      match,
      request,
      nonce: "redirect-nonce",
      start: performance.now(),
      clientBuild,
      secHeaders: {},
      wrapHTML,
    })

    const prodResponse = await handleProductionRoute({
      match,
      request,
      nonce: "redirect-nonce",
    })

    expect(devResponse.status).toBe(307)
    expect(prodResponse.status).toBe(307)
    expect(devResponse.headers.get("Location")).toBe("/login")
    expect(prodResponse.headers.get("Location")).toBe("/login")
  })
})

async function getMatch(pathname: string): Promise<MatchResult> {
  const routes = await createRouter(TMP)
  const match = matchRoute(routes, pathname, buildStaticMap(routes))
  if (!match) throw new Error(`Route not found for ${pathname}`)
  return match
}

async function handleProductionRoute(
  options: {
    match: MatchResult
    request: Request
    nonce: string
    manifestJs?: string
  },
): Promise<Response> {
  const { match, request, nonce, manifestJs } = options

  return handleRouteRequest({
    match,
    request,
    onPartialRequest: async ({ ctx, resolved }) => {
      const { pageComponent, loaderData, cssFiles } = resolved
      const rendered = renderPageDocument(pageComponent, ctx, match.params, loaderData)
      const payload = buildPartialResponsePayload(
        rendered,
        loaderData,
        match.params,
        cssFiles,
        createClientScriptPath(manifestJs),
      )
      return new Response(JSON.stringify(payload), {
        headers: partialNavigationHeaders(),
      })
    },
    onPageRequest: async ({ ctx, resolved }) => {
      const { pageComponent, loaderData, cssFiles } = resolved
      const rendered = renderPageDocument(pageComponent, ctx, match.params, loaderData)
      const html = wrapHTML(rendered.html, nonce, {
        clientScript: createClientScriptPath(manifestJs),
        loaderData,
        params: match.params,
        cssFiles,
        headElements: rendered.headElements,
      })
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      })
    },
  })
}
