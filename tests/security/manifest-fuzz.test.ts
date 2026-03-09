import { describe, expect, test } from "bun:test"
import { BUILD_MANIFEST_SCHEMA_VERSION, getPrerenderedHtmlPath, isPrerenderedRoute, type BuildManifest } from "../../src/server/manifest.ts"

describe("manifest helper fuzz-like boundaries", () => {
  test("getPrerenderedHtmlPath normalizes root and nested routes deterministically", () => {
    expect(getPrerenderedHtmlPath("/")).toBe("index.html")
    expect(getPrerenderedHtmlPath("/docs/security")).toBe("docs/security/index.html")
    expect(getPrerenderedHtmlPath("/docs/security/")).toBe("docs/security/index.html")
  })

  test("isPrerenderedRoute is fail-safe for unknown paths", () => {
    const manifest: BuildManifest = {
      schemaVersion: BUILD_MANIFEST_SCHEMA_VERSION,
      routes: {
        "/": { hasLoader: true, prerendered: true, js: "index.js" },
        "/docs/[slug]": { hasLoader: false, js: "docs.js" },
      },
      chunks: [],
      prerendered: ["/"],
      buildTime: new Date().toISOString(),
    }

    expect(isPrerenderedRoute(manifest, "/")).toBe(true)
    expect(isPrerenderedRoute(manifest, "/docs/[slug]")).toBe(false)
    expect(isPrerenderedRoute(manifest, "/does-not-exist")).toBe(false)
  })
})
