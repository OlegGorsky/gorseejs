import { join } from "node:path"
import { readFile } from "node:fs/promises"

export const BUILD_MANIFEST_SCHEMA_VERSION = 1 as const

export interface BuildManifestRoute {
  js?: string
  hasLoader: boolean
  prerendered?: boolean
}

export interface BuildManifest {
  schemaVersion: number
  routes: Record<string, BuildManifestRoute>
  chunks: string[]
  prerendered: string[]
  buildTime: string
}

export async function loadBuildManifest(distDir: string): Promise<BuildManifest> {
  const raw = await readFile(join(distDir, "manifest.json"), "utf-8")
  return parseBuildManifest(raw)
}

export function parseBuildManifest(raw: string): BuildManifest {
  const manifest = JSON.parse(raw) as Partial<BuildManifest>
  validateBuildManifest(manifest)
  return manifest
}

function validateBuildManifest(manifest: Partial<BuildManifest>): asserts manifest is BuildManifest {
  if (manifest.schemaVersion !== BUILD_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported build manifest schema version: expected ${BUILD_MANIFEST_SCHEMA_VERSION}, received ${String(manifest.schemaVersion)}`,
    )
  }
  if (!manifest.routes || typeof manifest.routes !== "object" || Array.isArray(manifest.routes)) {
    throw new Error("Invalid build manifest: routes must be an object")
  }
  if (!Array.isArray(manifest.chunks)) {
    throw new Error("Invalid build manifest: chunks must be an array")
  }
  if (!Array.isArray(manifest.prerendered)) {
    throw new Error("Invalid build manifest: prerendered must be an array")
  }
  if (typeof manifest.buildTime !== "string" || manifest.buildTime.length === 0) {
    throw new Error("Invalid build manifest: buildTime must be a non-empty string")
  }
}

export function getRouteBuildEntry(manifest: BuildManifest, pathname: string): BuildManifestRoute | undefined {
  return manifest.routes[pathname]
}

export function getClientBundleForRoute(manifest: BuildManifest, pathname: string): string | undefined {
  return getRouteBuildEntry(manifest, pathname)?.js
}

export function isPrerenderedRoute(manifest: BuildManifest, pathname: string): boolean {
  return getRouteBuildEntry(manifest, pathname)?.prerendered === true
}

export function getPrerenderedHtmlPath(pathname: string): string {
  return pathname === "/" ? "index.html" : join(pathname.slice(1), "index.html")
}
