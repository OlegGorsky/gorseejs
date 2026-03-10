import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  BUILD_MANIFEST_SCHEMA_VERSION,
  RELEASE_ARTIFACT_SCHEMA_VERSION,
  getClientBundleForRoute,
  getPrerenderedHtmlPath,
  getRouteBuildEntry,
  isPrerenderedRoute,
  loadBuildManifest,
  loadReleaseArtifact,
  parseBuildManifest,
  parseReleaseArtifact,
  type BuildManifest,
  type ReleaseArtifact,
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

  test("loads release artifact and validates mode-aware runtime surface", async () => {
    const tmpDir = join(process.cwd(), ".tmp-release-artifact-runtime")
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(tmpDir, { recursive: true })

    const artifact: ReleaseArtifact = {
      schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
      appMode: "server",
      generatedAt: "2026-03-10T00:00:00.000Z",
      summary: {
        routeCount: 1,
        clientAssetCount: 0,
        prerenderedCount: 0,
        serverEntryCount: 5,
      },
      runtime: {
        kind: "server-runtime",
        processEntrypoints: ["prod.js", "prod-node.js"],
        handlerEntrypoints: ["server-handler.js", "server-handler-node.js"],
        workerEntrypoint: "worker.js",
      },
      artifacts: {
        buildManifest: "manifest.json",
        clientAssets: [],
        serverEntries: ["prod.js", "prod-node.js", "server-handler.js", "server-handler-node.js", "worker.js"],
        prerenderedHtml: [],
      },
    }

    await writeFile(join(tmpDir, "release.json"), JSON.stringify(artifact, null, 2))

    const loaded = await loadReleaseArtifact(tmpDir)
    expect(loaded.appMode).toBe("server")
    expect(loaded.runtime.kind).toBe("server-runtime")
    expect(loaded.runtime.workerEntrypoint).toBe("worker.js")
    expect(loaded.summary.serverEntryCount).toBe(5)

    await rm(tmpDir, { recursive: true, force: true })
  })

  test("rejects release artifact schema drift fail-closed", () => {
    expect(() => parseReleaseArtifact(JSON.stringify({
      appMode: "frontend",
      generatedAt: "2026-03-10T00:00:00.000Z",
      summary: { routeCount: 1, clientAssetCount: 1, prerenderedCount: 1, serverEntryCount: 0 },
      runtime: { kind: "frontend-static", processEntrypoints: [], handlerEntrypoints: [] },
      artifacts: { buildManifest: "manifest.json", clientAssets: [], serverEntries: [], prerenderedHtml: [] },
    }))).toThrow(/Unsupported release artifact schema version/)
  })
})
