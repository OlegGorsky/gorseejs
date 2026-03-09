import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  BUILD_MANIFEST_SCHEMA_VERSION,
  getClientBundleForRoute,
  getPrerenderedHtmlPath,
  getRouteBuildEntry,
  isPrerenderedRoute,
  loadBuildManifest,
  parseBuildManifest,
  type BuildManifest,
} from "../../src/server/manifest.ts"

describe("server manifest runtime", () => {
  test("loads manifest and resolves route metadata through shared helpers", async () => {
    const tmpDir = join(process.cwd(), ".tmp-manifest-runtime")
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(tmpDir, { recursive: true })

    const manifest: BuildManifest = {
      schemaVersion: BUILD_MANIFEST_SCHEMA_VERSION,
      routes: {
        "/": { js: "index.123.js", hasLoader: true, prerendered: true },
        "/about": { hasLoader: false },
      },
      chunks: ["chunk-a.js"],
      prerendered: ["/"],
      buildTime: "2026-03-06T00:00:00.000Z",
    }

    await writeFile(join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2))

    const loaded = await loadBuildManifest(tmpDir)
    expect(getRouteBuildEntry(loaded, "/")).toEqual(manifest.routes["/"])
    expect(getClientBundleForRoute(loaded, "/")).toBe("index.123.js")
    expect(isPrerenderedRoute(loaded, "/")).toBe(true)
    expect(isPrerenderedRoute(loaded, "/about")).toBe(false)
    expect(getPrerenderedHtmlPath("/")).toBe("index.html")
    expect(getPrerenderedHtmlPath("/about")).toBe(join("about", "index.html"))

    await rm(tmpDir, { recursive: true, force: true })
  })

  test("rejects manifest schema drift fail-closed", () => {
    expect(() => parseBuildManifest(JSON.stringify({
      routes: { "/": { hasLoader: true, js: "index.123.js" } },
      chunks: [],
      prerendered: [],
      buildTime: "2026-03-06T00:00:00.000Z",
    }))).toThrow(/Unsupported build manifest schema version/)
  })
})
