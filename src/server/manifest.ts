import { join } from "node:path"
import { readFile } from "node:fs/promises"

export const BUILD_MANIFEST_SCHEMA_VERSION = 1 as const
export const RELEASE_ARTIFACT_SCHEMA_VERSION = 1 as const

export interface BuildManifestRoute {
  js?: string
  hasLoader: boolean
  prerendered?: boolean
}

export interface BuildManifest {
  schemaVersion: number
  appMode?: "frontend" | "fullstack" | "server"
  routes: Record<string, BuildManifestRoute>
  chunks: string[]
  prerendered: string[]
  buildTime: string
}

export interface ReleaseArtifactSummary {
  routeCount: number
  clientAssetCount: number
  prerenderedCount: number
  serverEntryCount: number
}

export interface ReleaseArtifactRuntime {
  kind: "frontend-static" | "fullstack-runtime" | "server-runtime"
  processEntrypoints: string[]
  handlerEntrypoints: string[]
  workerEntrypoint?: string
}

export interface ReleaseArtifactArtifacts {
  buildManifest: string
  clientAssets: string[]
  serverEntries: string[]
  prerenderedHtml: string[]
}

export interface ReleaseArtifact {
  schemaVersion: number
  appMode: "frontend" | "fullstack" | "server"
  generatedAt: string
  summary: ReleaseArtifactSummary
  runtime: ReleaseArtifactRuntime
  artifacts: ReleaseArtifactArtifacts
}

export async function loadBuildManifest(distDir: string): Promise<BuildManifest> {
  const raw = await readFile(join(distDir, "manifest.json"), "utf-8")
  return parseBuildManifest(raw)
}

export async function loadReleaseArtifact(distDir: string): Promise<ReleaseArtifact> {
  const raw = await readFile(join(distDir, "release.json"), "utf-8")
  return parseReleaseArtifact(raw)
}

export function parseBuildManifest(raw: string): BuildManifest {
  const manifest = JSON.parse(raw) as Partial<BuildManifest>
  validateBuildManifest(manifest)
  return manifest
}

export function parseReleaseArtifact(raw: string): ReleaseArtifact {
  const artifact = JSON.parse(raw) as Partial<ReleaseArtifact>
  validateReleaseArtifact(artifact)
  return artifact
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

function validateReleaseArtifact(artifact: Partial<ReleaseArtifact>): asserts artifact is ReleaseArtifact {
  if (artifact.schemaVersion !== RELEASE_ARTIFACT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported release artifact schema version: expected ${RELEASE_ARTIFACT_SCHEMA_VERSION}, received ${String(artifact.schemaVersion)}`,
    )
  }
  if (artifact.appMode !== "frontend" && artifact.appMode !== "fullstack" && artifact.appMode !== "server") {
    throw new Error("Invalid release artifact: appMode must be frontend, fullstack, or server")
  }
  if (typeof artifact.generatedAt !== "string" || artifact.generatedAt.length === 0) {
    throw new Error("Invalid release artifact: generatedAt must be a non-empty string")
  }
  if (!artifact.summary || typeof artifact.summary !== "object") {
    throw new Error("Invalid release artifact: summary must be an object")
  }
  if (!artifact.runtime || typeof artifact.runtime !== "object") {
    throw new Error("Invalid release artifact: runtime must be an object")
  }
  if (!artifact.artifacts || typeof artifact.artifacts !== "object") {
    throw new Error("Invalid release artifact: artifacts must be an object")
  }
  if (!Array.isArray(artifact.artifacts.clientAssets) || !Array.isArray(artifact.artifacts.serverEntries) || !Array.isArray(artifact.artifacts.prerenderedHtml)) {
    throw new Error("Invalid release artifact: artifact file groups must be arrays")
  }
  if (typeof artifact.artifacts.buildManifest !== "string" || artifact.artifacts.buildManifest.length === 0) {
    throw new Error("Invalid release artifact: buildManifest must be a non-empty string")
  }
  if (!Array.isArray(artifact.runtime.processEntrypoints) || !Array.isArray(artifact.runtime.handlerEntrypoints)) {
    throw new Error("Invalid release artifact: runtime entrypoint groups must be arrays")
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
