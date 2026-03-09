// gorsee build -- production build
// Bundles client JS, minifies, generates asset hashes

import { join } from "node:path"
import { mkdir, rm, writeFile, readdir, stat, watch } from "node:fs/promises"
import { createRouter } from "../router/scanner.ts"
import { buildClientBundles } from "../build/client.ts"
import { configureClientBuildBackend, type ClientBuildBackend } from "../build/client-backend.ts"
import { initializeBuildBackends } from "../build/init.ts"
import { generateStaticPages } from "../build/ssg.ts"
import { createBuildManifest } from "../build/manifest.ts"
import { createHash } from "node:crypto"
import { wrapHTML } from "../server/html-shell.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"
import { buildServerArtifacts } from "../build/server-bundle.ts"
import {
  configureAIObservability,
  emitAIDiagnostic,
  emitAIEvent,
  resolveAIObservabilityConfig,
  runWithAITrace,
  type AIObservabilityConfig,
} from "../ai/index.ts"
import { loadAppConfig, resolveAIConfig } from "../runtime/app-config.ts"
import { initializeCompilerBackends } from "../compiler/init.ts"

async function hashFile(path: string): Promise<string> {
  const content = await Bun.file(path).arrayBuffer()
  return createHash("sha256").update(new Uint8Array(content)).digest("hex").slice(0, 8)
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...await getAllFiles(full))
      } else {
        files.push(full)
      }
    }
  } catch {}
  return files
}

export interface BuildCommandOptions extends RuntimeOptions {
  minify?: boolean
  sourcemap?: boolean
  ai?: AIObservabilityConfig
  clientBuildBackend?: ClientBuildBackend
}

export async function buildProject(options: BuildCommandOptions = {}) {
  const { cwd, paths } = createProjectContext(options)
  initializeCompilerBackends(options.env ?? process.env)
  initializeBuildBackends(options.env ?? process.env)
  const appConfig = await loadAppConfig(cwd)
  configureAIObservability(resolveAIConfig(cwd, appConfig, options.ai) ?? resolveAIObservabilityConfig(cwd))

  try {
    await runWithAITrace({
      kind: "build.project",
      severity: "info",
      source: "build",
      message: "production build",
      phase: "build",
      data: { cwd, minify: options.minify ?? true, sourcemap: options.sourcemap ?? true },
    }, async () => {
      const startTime = performance.now()
      console.log("\n  Gorsee Build\n")

      await rm(paths.distDir, { recursive: true, force: true })
      await mkdir(paths.clientDir, { recursive: true })
      await mkdir(paths.serverDir, { recursive: true })

      const routes = await createRouter(paths.routesDir)
      console.log(`  [1/5] Found ${routes.length} route(s)`)
      await emitAIEvent({
        kind: "build.phase",
        severity: "info",
        source: "build",
        message: "routes scanned",
        phase: "scan-routes",
        data: { routes: routes.length },
      })

      const build = await buildClientBundles(routes, cwd, {
        minify: options.minify ?? true,
        sourcemap: options.sourcemap ?? true,
        backend: options.clientBuildBackend ?? configureClientBuildBackend(options.env ?? process.env),
      })
      console.log(`  [2/5] Client bundles built (${build.entryMap.size} entries)`)
      await emitAIEvent({
        kind: "build.phase",
        severity: "info",
        source: "build",
        message: "client bundles built",
        phase: "client-bundles",
        data: { entries: build.entryMap.size },
      })

      const clientSrc = join(paths.gorseeDir, "client")
      const clientFiles = await getAllFiles(clientSrc)
      const hashMap = new Map<string, string>()

      for (const file of clientFiles) {
        const rel = file.slice(clientSrc.length + 1)
        const preserveRuntimePath = rel.startsWith("chunks/") || rel.endsWith(".map")
        const hash = preserveRuntimePath ? null : await hashFile(file)
        const ext = rel.lastIndexOf(".")
        const hashed = preserveRuntimePath
          ? rel
          : ext > 0
            ? `${rel.slice(0, ext)}.${hash}${rel.slice(ext)}`
            : `${rel}.${hash}`
        const dest = join(paths.clientDir, hashed)
        await mkdir(join(dest, ".."), { recursive: true })
        await Bun.write(dest, Bun.file(file))
        hashMap.set(rel, hashed)
      }
      console.log(`  [3/5] Assets hashed (${hashMap.size} files)`)

      const manifest = await createBuildManifest(routes, build.entryMap, hashMap)
      await writeFile(join(paths.distDir, "manifest.json"), JSON.stringify(manifest, null, 2))
      const serverArtifacts = await buildServerArtifacts(cwd, paths.distDir)
      console.log(`  [4/5] Manifest + server entries generated`)

      const ssgResult = await generateStaticPages({
        routesDir: paths.routesDir,
        outDir: join(paths.distDir, "static"),
        wrapHTML: (body, htmlOptions = {}) => wrapHTML(body, undefined, htmlOptions),
      })
      const finalManifest = ssgResult.pages.size > 0
        ? await createBuildManifest(routes, build.entryMap, hashMap, ssgResult.pages.keys())
        : manifest
      if (ssgResult.pages.size > 0) {
        await writeFile(join(paths.distDir, "manifest.json"), JSON.stringify(finalManifest, null, 2))
      }
      if (ssgResult.errors.length > 0) {
        for (const err of ssgResult.errors) console.error(`  SSG error: ${err}`)
        for (const err of ssgResult.errors) {
          await emitAIEvent({
            kind: "diagnostic.issue",
            severity: "error",
            source: "build",
            message: err,
            code: "SSG",
            phase: "ssg",
          })
        }
      }
      console.log(`  [5/5] SSG: ${ssgResult.pages.size} page(s) pre-rendered`)

      let totalSize = 0
      for (const file of await getAllFiles(paths.clientDir)) {
        const s = await stat(file)
        totalSize += s.size
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
      console.log()
      console.log(`  Output: dist/`)
      console.log(`  Client size: ${(totalSize / 1024).toFixed(1)} KB`)
      console.log(`  Built in ${elapsed}s`)
      console.log()

      await emitAIEvent({
        kind: "build.summary",
        severity: ssgResult.errors.length > 0 ? "warn" : "info",
        source: "build",
        message: "build completed",
        phase: "summary",
        data: {
          artifact: "dist/",
          routes: routes.length,
          entries: build.entryMap.size,
          assets: hashMap.size,
          serverEntries: serverArtifacts.serverEntries,
          prerenderedPages: ssgResult.pages.size,
          ssgErrors: ssgResult.errors.length,
          clientKb: Number((totalSize / 1024).toFixed(1)),
          elapsedSeconds: Number(elapsed),
        },
      })
    })
  } catch (error) {
    await emitAIDiagnostic({
      code: "BUILD_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      severity: "error",
      source: "build",
      fix: "Inspect structured build diagnostics, build backend logs, and docs/BUILD_DIAGNOSTICS.md.",
    })
    throw error
  }
}

export async function watchBuildProject(options: BuildCommandOptions = {}) {
  const { paths } = createProjectContext(options)

  console.log("\n  Gorsee Build --watch\n")
  console.log("  Performing initial build...")
  await buildProject(options)

  let building = false
  let queued = false

  async function rebuild() {
    if (building) { queued = true; return }
    building = true
    try {
      const start = performance.now()
      await buildProject(options)
      const ms = (performance.now() - start).toFixed(0)
      console.log(`  Rebuilt in ${ms}ms`)
    } catch (err) {
      console.error("  Build error:", err)
    } finally {
      building = false
      if (queued) { queued = false; await rebuild() }
    }
  }

  console.log("  Watching for changes...")
  const watcher = watch(paths.routesDir, { recursive: true })
  for await (const _event of watcher) {
    await rebuild()
  }
}

export async function runBuild(args: string[], options: BuildCommandOptions = {}) {
  if (args.includes("--watch")) {
    return watchBuildProject(options)
  }
  return buildProject(options)
}
