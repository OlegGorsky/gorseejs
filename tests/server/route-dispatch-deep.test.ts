import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildStaticMap, createRouter, matchRoute } from "../../src/router/index.ts"
import { renderNotFoundPage } from "../../src/server/not-found.ts"
import { handleRouteRequest } from "../../src/server/route-request.ts"
import { renderRoutePageResponse, renderRoutePartialResponse } from "../../src/server/route-response.ts"
import { createRuntimeRequestPlan } from "../../src/server/request-surface.ts"
import { dispatchRuntimeRequestPlan } from "../../src/server/runtime-dispatch.ts"

const TMP = join(process.cwd(), ".tmp-route-dispatch-deep")

describe("route dispatch deep", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "docs"), { recursive: true })

    await writeFile(join(TMP, "404.tsx"), `
      export default function CustomNotFound() {
        return <main>Custom dispatch missing</main>
      }
    `.trim())

    await writeFile(join(TMP, "docs", "_layout.tsx"), `
      export async function loader(ctx) {
        ctx.locals.layoutAttempted = true
        throw new Error("layout loader failed")
      }

      export default function DocsLayout(props) {
        return <section data-layout="docs">{props.children()}</section>
      }
    `.trim())

    await writeFile(join(TMP, "docs", "layout-failure.tsx"), `
      export async function loader(ctx) {
        ctx.locals.pageLoaderRan = true
        return { ok: true }
      }

      export default function LayoutFailurePage() {
        return <main>layout failure page</main>
      }
    `.trim())

    await writeFile(join(TMP, "docs", "page-load-failure.tsx"), `
      export async function load(ctx) {
        ctx.locals.pageLoadAttempted = true
        throw new Error("page load failed")
      }

      export default function PageLoadFailure() {
        return <main>page load failure</main>
      }
    `.trim())

    await writeFile(join(TMP, "page-render-failure.tsx"), `
      export async function load() {
        return { ok: true }
      }

      export default function RenderFailurePage() {
        throw new Error("page render failed")
      }
    `.trim())

    await mkdir(join(TMP, "render-layout"), { recursive: true })
    await writeFile(join(TMP, "render-layout", "_layout.tsx"), `
      export default function FailingLayout() {
        throw new Error("layout render failed")
      }
    `.trim())

    await writeFile(join(TMP, "render-layout", "page.tsx"), `
      export async function load() {
        return { ok: true }
      }

      export default function LayoutWrappedPage() {
        return <main>layout wrapped page</main>
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("handleRouteRequest surfaces page load failures through onRouteError", async () => {
    const response = await handlePath("/docs/page-load-failure", async (error, ctx) => {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe("page load failed")
      expect(ctx.ctx.locals.pageLoadAttempted).toBe(true)
      return Response.json({
        stage: "page-load",
        message: (error as Error).message,
        pageLoadAttempted: ctx.ctx.locals.pageLoadAttempted,
      }, { status: 500 })
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      stage: "page-load",
      message: "page load failed",
      pageLoadAttempted: true,
    })
  })

  test("handleRouteRequest surfaces layout loader failures after page data resolution starts", async () => {
    const response = await handlePath("/docs/layout-failure", async (error, ctx) => {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe("layout loader failed")
      expect(ctx.ctx.locals.pageLoaderRan).toBe(true)
      expect(ctx.ctx.locals.layoutAttempted).toBe(true)
      return Response.json({
        stage: "layout-load",
        message: (error as Error).message,
        pageLoaderRan: ctx.ctx.locals.pageLoaderRan,
        layoutAttempted: ctx.ctx.locals.layoutAttempted,
      }, { status: 500 })
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      stage: "layout-load",
      message: "layout loader failed",
      pageLoaderRan: true,
      layoutAttempted: true,
    })
  })

  test("runtime dispatch returns custom not-found html when no route matches", async () => {
    const pathname = "/docs/missing"
    const routes = await createRouter(TMP)
    const match = matchRoute(routes, pathname, buildStaticMap(routes))
    const plan = createRuntimeRequestPlan({
      pathname,
      hasRouteMatch: Boolean(match),
    }).filter((surface): surface is Exclude<typeof surface, "hmr"> => surface !== "hmr")

    const result = await dispatchRuntimeRequestPlan({
      plan,
      pathname,
      request: new Request(`http://localhost${pathname}`),
      trace: { requestId: "req-nf", traceId: "trace-nf", spanId: "span-nf" },
      startTs: performance.now(),
      source: "runtime",
      handlers: {
        static: async () => null,
        route: async () => {
          throw new Error("route handler should not run without a match")
        },
        "not-found": async () => new Response(await renderNotFoundPage(TMP, "dispatch-nonce"), {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }),
      },
    })

    expect(result).not.toBeNull()
    expect(result?.surface).toBe("not-found")
    expect(result?.response.status).toBe(404)
    await expect(result?.response.text()).resolves.toContain("Custom dispatch missing")
  })

  test("handleRouteRequest surfaces page component render failures from full page rendering", async () => {
    const response = await handleRenderedPath("/page-render-failure", async (error) => {
      expect((error as Error).message).toBe("page render failed")
      return Response.json({ stage: "page-render", message: (error as Error).message }, { status: 500 })
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      stage: "page-render",
      message: "page render failed",
    })
  })

  test("handleRouteRequest surfaces layout component render failures from partial rendering", async () => {
    const response = await handleRenderedPath("/render-layout/page", async (error) => {
      expect((error as Error).message).toBe("layout render failed")
      return Response.json({ stage: "layout-render", message: (error as Error).message }, { status: 500 })
    }, true)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      stage: "layout-render",
      message: "layout render failed",
    })
  })
})

async function handlePath(
  pathname: string,
  onRouteError: NonNullable<Parameters<typeof handleRouteRequest>[0]["onRouteError"]>,
): Promise<Response> {
  const routes = await createRouter(TMP)
  const match = matchRoute(routes, pathname, buildStaticMap(routes))
  if (!match) throw new Error(`route not found: ${pathname}`)

  return handleRouteRequest({
    match,
    request: new Request(`http://localhost${pathname}`, {
      headers: { Origin: "https://app.example.com" },
    }),
    trustedOrigin: "https://app.example.com",
    onRouteError,
    onPartialRequest: async ({ resolved }) => Response.json(resolved.loaderData),
    onPageRequest: async ({ resolved }) => Response.json(resolved.loaderData),
  })
}

async function handleRenderedPath(
  pathname: string,
  onRouteError: NonNullable<Parameters<typeof handleRouteRequest>[0]["onRouteError"]>,
  partial = false,
): Promise<Response> {
  const routes = await createRouter(TMP)
  const match = matchRoute(routes, pathname, buildStaticMap(routes))
  if (!match) throw new Error(`route not found: ${pathname}`)

  return handleRouteRequest({
    match,
    request: new Request(`http://localhost${pathname}`, {
      headers: partial
        ? {
          Origin: "https://app.example.com",
          Accept: "application/json",
          "X-Gorsee-Navigate": "partial",
        }
        : { Origin: "https://app.example.com" },
    }),
    trustedOrigin: "https://app.example.com",
    onRouteError,
    onPartialRequest: async ({ match, ctx, resolved }) => renderRoutePartialResponse({
      match,
      ctx,
      resolved,
      clientScript: "/_gorsee/app.js",
    }),
    onPageRequest: async ({ match, ctx, resolved }) => renderRoutePageResponse({
      match,
      ctx,
      resolved,
      nonce: "route-nonce",
      clientScript: "/_gorsee/app.js",
      wrapHTML: (body) => `<!doctype html><html><body>${body}</body></html>`,
    }),
  })
}
