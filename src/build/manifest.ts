import type { Route } from "../router/scanner.ts"
import { inspectRouteBuildMetadata } from "./route-metadata.ts"
import {
  BUILD_MANIFEST_SCHEMA_VERSION,
  RELEASE_ARTIFACT_SCHEMA_VERSION,
  type BuildManifest,
  type ReleaseArtifact,
} from "../server/manifest.ts"
import type { AppMode } from "../runtime/app-config.ts"

export async function createBuildManifest(
  routes: Route[],
  entryMap: Map<string, string>,
  hashMap: Map<string, string>,
  prerenderedPaths: Iterable<string> = [],
  appMode: AppMode = "fullstack",
): Promise<BuildManifest> {
  const prerendered = new Set(prerenderedPaths)
  const manifest: BuildManifest = {
    schemaVersion: BUILD_MANIFEST_SCHEMA_VERSION,
    appMode,
    routes: {},
    chunks: [],
    prerendered: [...prerendered],
    buildTime: new Date().toISOString(),
  }

  for (const route of routes) {
    const metadata = await inspectRouteBuildMetadata(route)
    const jsRel = entryMap.get(route.path)
    manifest.routes[route.path] = {
      js: jsRel ? hashMap.get(jsRel) : undefined,
      hasLoader: metadata.hasLoader,
      prerendered: prerendered.has(route.path) || undefined,
    }
  }

  for (const hashed of hashMap.values()) {
    if (hashed.includes("chunk-")) manifest.chunks.push(hashed)
  }

  return manifest
}

export function createReleaseArtifact(
  manifest: BuildManifest,
  clientAssets: Iterable<string>,
  serverEntries: Iterable<string>,
): ReleaseArtifact {
  const clientAssetList = [...clientAssets].sort()
  const serverEntryList = [...serverEntries].sort()
  const prerenderedHtml = manifest.prerendered
    .map((pathname) => pathname === "/" ? "static/index.html" : `static/${pathname.slice(1)}/index.html`)
    .sort()

  const processEntrypoints = serverEntryList.filter((entry) => entry === "prod.js" || entry === "prod-node.js")
  const handlerEntrypoints = serverEntryList.filter((entry) => entry === "server-handler.js" || entry === "server-handler-node.js")
  const workerEntrypoint = serverEntryList.includes("worker.js") ? "worker.js" : undefined

  return {
    schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
    appMode: manifest.appMode ?? "fullstack",
    generatedAt: manifest.buildTime,
    summary: {
      routeCount: Object.keys(manifest.routes).length,
      clientAssetCount: clientAssetList.length,
      prerenderedCount: manifest.prerendered.length,
      serverEntryCount: serverEntryList.length,
    },
    runtime: {
      kind: manifest.appMode === "frontend"
        ? "frontend-static"
        : manifest.appMode === "server"
          ? "server-runtime"
          : "fullstack-runtime",
      processEntrypoints,
      handlerEntrypoints,
      workerEntrypoint,
    },
    artifacts: {
      buildManifest: "manifest.json",
      clientAssets: clientAssetList,
      serverEntries: serverEntryList,
      prerenderedHtml,
    },
  }
}
