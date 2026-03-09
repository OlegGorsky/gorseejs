import { describe, expect, test } from "bun:test"
import { renderRouteErrorBoundaryResponse, renderRoutePageResponse } from "../../src/server/route-response.ts"

const match = {
  params: { slug: "docs" },
  route: {} as never,
}

const ctx = {
  locals: {},
} as never

describe("route failure contract", () => {
  test("streaming page responses fail with an explicit contract error when wrapHTML is missing", async () => {
    await expect(renderRoutePageResponse({
      match,
      ctx,
      resolved: {
        pageComponent: () => ({ type: "main", props: { children: "stream" } }),
        component: () => null,
        loaderData: { ok: true },
        cssFiles: [],
        renderMode: "stream",
      },
    })).rejects.toThrow("wrapHTML is required for streaming page responses")
  })

  test("error boundary responses stay HTML-shaped and preserve explicit headers", async () => {
    const response = await renderRouteErrorBoundaryResponse(
      new URL("./fixtures/route-error-boundary.tsx", import.meta.url).pathname,
      new Error("route failed"),
      {
        match,
        nonce: "nonce-err",
        secHeaders: { "X-Test": "1" },
        wrapHTML: (body, nonce, options = {}) => `
<!doctype html>
<html>
  <head><title>${options.title ?? "Untitled"}</title></head>
  <body data-nonce="${nonce}">${body}</body>
</html>`.trim(),
      },
    )

    const html = await response.text()
    expect(response.status).toBe(500)
    expect(response.headers.get("Content-Type")).toContain("text/html")
    expect(response.headers.get("X-Test")).toBe("1")
    expect(html).toContain("<title>Error</title>")
    expect(html).toContain("route failed")
    expect(html).toContain("docs")
  })
})
