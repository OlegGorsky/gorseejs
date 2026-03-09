import { readdir, rm } from "node:fs/promises"
import { basename, dirname, join, relative } from "node:path"
import type { BuildManifest } from "../server/manifest.ts"
import { loadBuildManifest } from "../server/manifest.ts"
import type { ClientBuildBackend, ClientBuildBackendOptions, ClientBuildBackendResult } from "./client-backend.ts"

export interface ClientBuildOutputSurface {
  files: string[]
  jsFiles: string[]
  sourcemaps: string[]
}

export interface ClientBuildBackendParityReport {
  leftBackend: string
  rightBackend: string
  matches: boolean
  outputMatches: boolean
  left: Pick<ClientBuildBackendResult, "success" | "logs">
  right: Pick<ClientBuildBackendResult, "success" | "logs">
  leftOutput: ClientBuildOutputSurface
  rightOutput: ClientBuildOutputSurface
}

export async function compareClientBuildBackends(
  leftBackend: ClientBuildBackend,
  rightBackend: ClientBuildBackend,
  options: ClientBuildBackendOptions,
): Promise<ClientBuildBackendParityReport> {
  const leftOptions = createBackendParityOptions(options, leftBackend.name)
  const rightOptions = createBackendParityOptions(options, rightBackend.name)

  await Promise.all([
    rm(leftOptions.outdir, { recursive: true, force: true }),
    rm(rightOptions.outdir, { recursive: true, force: true }),
  ])

  const left = await leftBackend.build(leftOptions)
  const right = await rightBackend.build(rightOptions)
  const leftShape = { success: left.success, logs: left.logs }
  const rightShape = { success: right.success, logs: right.logs }
  const leftOutput = await readClientBuildOutputSurface(leftOptions.outdir)
  const rightOutput = await readClientBuildOutputSurface(rightOptions.outdir)
  const outputMatches = JSON.stringify(leftOutput) === JSON.stringify(rightOutput)

  return {
    leftBackend: leftBackend.name,
    rightBackend: rightBackend.name,
    matches: JSON.stringify(leftShape) === JSON.stringify(rightShape) && outputMatches,
    outputMatches,
    left: leftShape,
    right: rightShape,
    leftOutput,
    rightOutput,
  }
}

export interface BuildArtifactRouteSurface {
  path: string
  hasLoader: boolean
  prerendered: boolean
  hasClientBundle: boolean
}

export interface BuildArtifactSurface {
  routes: BuildArtifactRouteSurface[]
  prerendered: string[]
  chunkCount: number
  cssArtifacts: string[]
  staticPages: string[]
  serverEntries: string[]
}

export async function readBuildArtifactSurface(distDir: string): Promise<BuildArtifactSurface> {
  const manifest = await loadBuildManifest(distDir)
  const staticDir = join(distDir, "static")
  const clientDir = join(distDir, "client")
  const staticFiles = await listFiles(staticDir, staticDir)
  const clientFiles = await listFiles(clientDir, clientDir)
  const distFiles = await listFiles(distDir, distDir)

  return {
    routes: normalizeManifestRoutes(manifest),
    prerendered: [...manifest.prerendered].sort(),
    chunkCount: manifest.chunks.length,
    cssArtifacts: clientFiles.filter((file) => file.endsWith(".css")).sort(),
    staticPages: staticFiles.filter((file) => file.endsWith(".html")).sort(),
    serverEntries: distFiles.filter((file) =>
      file === "prod.js"
      || file === "prod-node.js"
      || file === "server-handler.js"
      || file === "server-handler-node.js"
      || file === "worker.js"
    ).sort(),
  }
}

function normalizeManifestRoutes(manifest: BuildManifest): BuildArtifactRouteSurface[] {
  return Object.entries(manifest.routes)
    .map(([path, route]) => ({
      path,
      hasLoader: route.hasLoader,
      prerendered: route.prerendered === true,
      hasClientBundle: typeof route.js === "string" && route.js.length > 0,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

async function listFiles(root: string, baseDir: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const full = join(root, entry.name)
      if (entry.isDirectory()) {
        files.push(...await listFiles(full, baseDir))
        continue
      }
      files.push(relative(baseDir, full))
    }
    return files
  } catch {
    return []
  }
}

function createBackendParityOptions(
  options: ClientBuildBackendOptions,
  backendName: string,
): ClientBuildBackendOptions {
  const outdirBase = basename(options.outdir)
  const outdirParent = dirname(options.outdir)
  return {
    ...options,
    outdir: join(outdirParent, `${outdirBase}-${backendName}`),
  }
}

async function readClientBuildOutputSurface(outdir: string): Promise<ClientBuildOutputSurface> {
  const files = (await listFiles(outdir, outdir)).sort()
  return {
    files,
    jsFiles: files.filter((file) => file.endsWith(".js")),
    sourcemaps: files.filter((file) => file.endsWith(".map")),
  }
}
