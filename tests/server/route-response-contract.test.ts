import { describe, expect, test } from "bun:test"
import { renderRoutePageResponse, renderRoutePartialResponse } from "../../src/server/route-response.ts"

const match = {
  params: { id: "42" },
  route: {} as never,
}

const ctx = {
  locals: {},
} as never

const resolved = {
  pageComponent: (props: { data: { message: string } }) => ({
    type: "main",
    props: { children: props.data.message },
  }),
  component: () => null,
  loaderData: { message: "hello contract" },
  cssFiles: ["/assets/page.css"],
  renderMode: "sync",
}

describe("route response contract", () => {
  test("page responses render HTML shell with loader data, params, css, and client script", async () => {
    const response = await renderRoutePageResponse({
      match,
      ctx,
      resolved,
      nonce: "nonce-1",
      clientScript: "/_gorsee/index.js",
      secHeaders: { "X-Test": "1" },
      wrapHTML: (body, nonce, options = {}) => `
<!doctype html>
<html>
  <body data-nonce="${nonce}">
    <div data-css="${(options.cssFiles ?? []).join(",")}" data-script="${options.clientScript ?? ""}">${body}</div>
    <script id="data">${JSON.stringify(options.loaderData)}</script>
    <script id="params">${JSON.stringify(options.params)}</script>
  </body>
</html>`.trim(),
    })

    const html = await response.text()
    expect(response.headers.get("Content-Type")).toContain("text/html")
    expect(response.headers.get("X-Test")).toBe("1")
    expect(html).toContain("hello contract")
    expect(html).toContain('data-css="/assets/page.css"')
    expect(html).toContain('data-script="/_gorsee/index.js"')
    expect(html).toContain('"message":"hello contract"')
    expect(html).toContain('"id":"42"')
  })

  test("partial responses always return json with no-store and vary headers", async () => {
    const response = renderRoutePartialResponse({
      match,
      ctx,
      resolved,
      clientScript: "/_gorsee/index.js",
      secHeaders: { "X-Test": "1" },
    })

    const payload = await response.json() as Record<string, unknown>
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(response.headers.get("Vary")).toContain("Accept")
    expect(response.headers.get("Vary")).toContain("X-Gorsee-Navigate")
    expect(response.headers.get("X-Test")).toBe("1")
    expect(payload.html).toContain("hello contract")
    expect(payload.script).toBe("/_gorsee/index.js")
    expect(payload.title).toBeUndefined()
    expect(payload.params).toEqual({ id: "42" })
    expect(payload.css).toEqual(["/assets/page.css"])
  })
})
