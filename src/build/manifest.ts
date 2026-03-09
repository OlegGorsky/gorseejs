import type { Route } from "../router/scanner.ts"
import { inspectRouteBuildMetadata } from "./route-metadata.ts"
import { BUILD_MANIFEST_SCHEMA_VERSION, type BuildManifest } from "../server/manifest.ts"

export async function createBuildManifest(
  routes: Route[],
  entryMap: Map<string, string>,
  hashMap: Map<string, string>,
  prerenderedPaths: Iterable<string> = [],
): Promise<BuildManifest> {
  const prerendered = new Set(prerenderedPaths)
  const manifest: BuildManifest = {
    schemaVersion: BUILD_MANIFEST_SCHEMA_VERSION,
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
