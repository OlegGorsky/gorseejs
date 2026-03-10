import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Head } from "../../src/runtime/head.ts"
import { StreamSuspense } from "../../src/runtime/stream.ts"
import { renderNotFoundPage } from "../../src/server/not-found.ts"
import {
  renderRouteErrorBoundaryResponse,
  renderRoutePageResponse,
  renderRoutePartialResponse,
} from "../../src/server/route-response.ts"

const TMP = join(process.cwd(), ".tmp-route-response-deep")

const match = {
  params: { slug: "guide" },
  route: {} as never,
}

const ctx = {
  locals: {},
} as never

describe("route response deep", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "404.tsx"), `
      export default function NotFoundPage() {
        return { type: "main", props: { children: "Custom missing" } }
      }
    `.trim())
    await writeFile(join(TMP, "bad-error-boundary.ts"), `export const nope = true`)
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("streaming page responses carry collected head elements into the shell", async () => {
    const response = await renderRoutePageResponse({
      match,
      ctx,
      resolved: {
        pageComponent: () => {
          Head({
            children: { type: "title", props: { children: "Streaming Guide" } },
          })
          return { type: "main", props: { children: "stream-body" } }
        },
        component: () => null,
        loaderData: { ok: true },
        cssFiles: ["/assets/guide.css"],
        renderMode: "stream",
      },
      nonce: "stream-nonce",
      clientScript: "/_gorsee/guide.js",
      wrapHTML: (body, nonce, options = {}) => `
<!doctype html>
<html>
  <head>${(options.headElements ?? []).join("")}</head>
  <body data-nonce="${nonce}" data-css="${(options.cssFiles ?? []).join(",")}" data-script="${options.clientScript}">
    ${body}
  </body>
</html>`.trim(),
    })

    const html = await response.text()
    expect(response.headers.get("Content-Type")).toContain("text/html")
    expect(html).toContain("<title>Streaming Guide</title>")
    expect(html).toContain("stream-body")
    expect(html).toContain('data-css="/assets/guide.css"')
    expect(html).toContain('data-script="/_gorsee/guide.js"')
  })

  test("partial responses include derived title when head collected during render", async () => {
    const response = renderRoutePartialResponse({
      match,
      ctx,
      resolved: {
        pageComponent: () => {
          Head({
            children: { type: "title", props: { children: "Guide Title" } },
          })
          return { type: "article", props: { children: "partial-body" } }
        },
        component: () => null,
        loaderData: { section: "intro" },
        cssFiles: [],
        renderMode: "sync",
      },
    })

    const payload = await response.json() as Record<string, unknown>
    expect(payload.title).toBe("Guide Title")
    expect(String(payload.html)).toContain("partial-body")
  })

  test("streaming page responses propagate shell render failures when the page component throws", async () => {
    const response = await renderRoutePageResponse({
      match,
      ctx,
      resolved: {
        pageComponent: () => {
          throw new Error("stream shell failed")
        },
        component: () => null,
        loaderData: {},
        cssFiles: [],
        renderMode: "stream",
      },
      wrapHTML: (body) => body,
    })

    await expect(response.text()).rejects.toThrow("stream shell failed")
  })

  test("streaming page responses keep the shell and emit error chunks for suspense failures", async () => {
    const response = await renderRoutePageResponse({
      match,
      ctx,
      resolved: {
        pageComponent: () => ({
          type: "main",
          props: {
            children: StreamSuspense({
              fallback: { type: "p", props: { children: "Loading chunk..." } },
              children: async () => {
                throw new Error("streamed data failed")
              },
            }),
          },
        }),
        component: () => null,
        loaderData: {},
        cssFiles: [],
        renderMode: "stream",
      },
      wrapHTML: (body) => `<!doctype html><html><body>${body}</body></html>`,
    })

    const html = await response.text()
    expect(html).toContain("Loading chunk...")
    expect(html).toContain("Error: streamed data failed")
    expect(html).toContain("data-g-suspense")
    expect(html).toContain("data-g-chunk")
  })

  test("error boundary response rethrows the original error when module has no default component", async () => {
    const error = new Error("boom")

    await expect(renderRouteErrorBoundaryResponse(
      join(TMP, "bad-error-boundary.ts"),
      error,
      {
        match,
        wrapHTML: (body) => body,
      },
    )).rejects.toBe(error)
  })

  test("renderNotFoundPage falls back to the built-in body when no route file exists", async () => {
    const html = await renderNotFoundPage(join(TMP, "missing-routes"), "nf-nonce", {
      bodyPrefix: ["<div>prefix</div>"],
      bodySuffix: ["<div>suffix</div>"],
      headElements: ["<meta name=\"robots\" content=\"noindex\" />"],
    })

    expect(html).toContain("<h1>404</h1><p>Page not found</p>")
    expect(html).toContain("<div>prefix</div>")
    expect(html).toContain("<div>suffix</div>")
    expect(html).toContain('content="noindex"')
  })

  test("renderNotFoundPage renders custom route modules when present", async () => {
    const html = await renderNotFoundPage(TMP, "nf-custom")
    expect(html).toContain("Custom missing")
  })
})
