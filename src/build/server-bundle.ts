import { existsSync } from "node:fs"
import { basename, join, relative, resolve } from "node:path"
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import ts from "typescript"

const FRAMEWORK_ROOT = resolve(import.meta.dir, "..")

function resolveFrameworkModule(stem: string): string {
  const tsPath = join(FRAMEWORK_ROOT, `${stem}.ts`)
  if (existsSync(tsPath)) return tsPath

  const jsPath = join(FRAMEWORK_ROOT, `${stem}.js`)
  if (existsSync(jsPath)) return jsPath

  return tsPath
}

export interface ServerBundleSurface {
  serverEntries: string[]
}

export async function buildServerArtifacts(cwd: string, distDir: string): Promise<ServerBundleSurface> {
  const entryDir = join(cwd, ".gorsee", "server")
  const compiledAppDir = join(distDir, "server", "app")
  const runtimePathOverrides = {
    routesDir: join(compiledAppDir, "routes"),
    sharedDir: join(compiledAppDir, "shared"),
    middlewareDir: join(compiledAppDir, "middleware"),
    appConfigFile: join(compiledAppDir, "app.config.js"),
  }
  await rm(entryDir, { recursive: true, force: true })
  await mkdir(entryDir, { recursive: true })
  await compileServerAppForNode(cwd, compiledAppDir)

  const prodEntry = join(entryDir, "prod-entry.ts")
  const prodNodeEntry = join(entryDir, "prod-node-entry.ts")
  const serverHandlerEntry = join(entryDir, "server-handler-entry.ts")
  const serverHandlerNodeEntry = join(entryDir, "server-handler-node-entry.ts")
  const workerEntry = join(entryDir, "worker-entry.ts")

  await writeFile(prodEntry, createProdEntrySource(cwd, runtimePathOverrides), "utf-8")
  await writeFile(prodNodeEntry, createProdNodeEntrySource(cwd, runtimePathOverrides), "utf-8")
  await writeFile(serverHandlerEntry, createServerHandlerEntrySource(cwd, runtimePathOverrides), "utf-8")
  await writeFile(serverHandlerNodeEntry, createServerHandlerNodeEntrySource(cwd, runtimePathOverrides), "utf-8")
  await writeFile(workerEntry, createWorkerEntrySource(serverHandlerEntry), "utf-8")

  await bundleServerEntry(prodEntry, join(distDir, "prod.js"))
  await bundleServerEntry(prodNodeEntry, join(distDir, "prod-node.js"), "node")
  await bundleServerEntry(serverHandlerEntry, join(distDir, "server-handler.js"))
  await bundleServerEntry(serverHandlerNodeEntry, join(distDir, "server-handler-node.js"), "node")
  await bundleServerEntry(workerEntry, join(distDir, "worker.js"))

  return {
    serverEntries: ["prod.js", "prod-node.js", "server-handler.js", "server-handler-node.js", "worker.js"],
  }
}

async function bundleServerEntry(entrypoint: string, outfile: string, target: "bun" | "node" = "bun"): Promise<void> {
  const outdir = join(dirnameOf(outfile), ".server-bundle")
  await rm(outdir, { recursive: true, force: true })
  await mkdir(outdir, { recursive: true })

  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir,
    target,
    format: "esm",
    minify: false,
    sourcemap: "none",
    naming: "[name].js",
  })

  if (!result.success) {
    const message = result.logs.map((log) => log.message).join("\n")
    throw new Error(message || `Server build failed for ${outfile}`)
  }

  const expectedName = `${basename(entrypoint).replace(/\.[^.]+$/, "")}.js`
  await rename(join(outdir, expectedName), outfile)
  await rm(outdir, { recursive: true, force: true })
}

function createProdEntrySource(cwd: string, pathOverrides: Record<string, string>): string {
  const prodModule = JSON.stringify(resolveFrameworkModule("prod"))
  const projectCwd = JSON.stringify(cwd)
  const serializedOverrides = JSON.stringify(pathOverrides, null, 2)
  return `import {
  createProductionFetchHandler as createBundledProductionFetchHandler,
  startProductionServer as startBundledProductionServer,
} from ${prodModule}

const PROJECT_CWD = ${projectCwd}
const PATH_OVERRIDES = ${serializedOverrides}

export function createProductionFetchHandler(options = {}) {
  return createBundledProductionFetchHandler({
    cwd: PROJECT_CWD,
    pathOverrides: PATH_OVERRIDES,
    ...options,
  })
}

export function startProductionServer(options = {}) {
  return startBundledProductionServer({
    cwd: PROJECT_CWD,
    pathOverrides: PATH_OVERRIDES,
    ...options,
  })
}
`
}

function createProdNodeEntrySource(cwd: string, pathOverrides: Record<string, string>): string {
  const prodModule = JSON.stringify(resolveFrameworkModule("prod"))
  const projectCwd = JSON.stringify(cwd)
  const serializedOverrides = JSON.stringify(pathOverrides, null, 2)

  return `import {
  createProductionFetchHandler as createBundledProductionFetchHandler,
  startNodeProductionServer as startBundledNodeProductionServer,
} from ${prodModule}

const PROJECT_CWD = ${projectCwd}
const PATH_OVERRIDES = ${serializedOverrides}

export function createProductionFetchHandler(options = {}) {
  return createBundledProductionFetchHandler({
    cwd: PROJECT_CWD,
    pathOverrides: PATH_OVERRIDES,
    ...options,
  })
}

export function startNodeProductionServer(options = {}) {
  return startBundledNodeProductionServer({
    cwd: PROJECT_CWD,
    pathOverrides: PATH_OVERRIDES,
    ...options,
  })
}
`
}

function createServerHandlerEntrySource(cwd: string, pathOverrides: Record<string, string>): string {
  const prodModule = JSON.stringify(resolveFrameworkModule("prod"))
  const projectCwd = JSON.stringify(cwd)
  const serializedOverrides = JSON.stringify(pathOverrides, null, 2)

  return `import { createProductionFetchHandler } from ${prodModule}

const PROJECT_CWD = ${projectCwd}
const PATH_OVERRIDES = ${serializedOverrides}

let cachedFetchHandlerPromise

async function getFetchHandler(options = {}) {
  if (!cachedFetchHandlerPromise) {
    cachedFetchHandlerPromise = createProductionFetchHandler({
      cwd: PROJECT_CWD,
      pathOverrides: PATH_OVERRIDES,
      ...options,
    })
  }

  return cachedFetchHandlerPromise
}

export async function handleRequest(request, runtimeContext = {}, options = {}) {
  const handler = await getFetchHandler(options)
  const server = typeof runtimeContext?.requestIP === "function"
    ? { requestIP: (input) => runtimeContext.requestIP(input) }
    : undefined
  return handler(request, server)
}
`
}

function createServerHandlerNodeEntrySource(cwd: string, pathOverrides: Record<string, string>): string {
  const prodModule = JSON.stringify(resolveFrameworkModule("prod"))
  const projectCwd = JSON.stringify(cwd)
  const serializedOverrides = JSON.stringify(pathOverrides, null, 2)

  return `import { createProductionFetchHandler } from ${prodModule}

const PROJECT_CWD = ${projectCwd}
const PATH_OVERRIDES = ${serializedOverrides}

let cachedFetchHandlerPromise

async function getFetchHandler(options = {}) {
  if (!cachedFetchHandlerPromise) {
    cachedFetchHandlerPromise = createProductionFetchHandler({
      cwd: PROJECT_CWD,
      pathOverrides: PATH_OVERRIDES,
      ...options,
    })
  }

  return cachedFetchHandlerPromise
}

export async function handleRequest(request, runtimeContext = {}, options = {}) {
  const handler = await getFetchHandler(options)
  const server = typeof runtimeContext?.requestIP === "function"
    ? { requestIP: (input) => runtimeContext.requestIP(input) }
    : undefined
  return handler(request, server)
}
`
}

function createWorkerEntrySource(serverHandlerEntry: string): string {
  const serverHandlerModule = JSON.stringify(serverHandlerEntry)
  return `import { handleRequest } from ${serverHandlerModule}

export default {
  async fetch(request, env, ctx) {
    void ctx
    return handleRequest(request, env)
  },
}
`
}

function dirnameOf(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  return index >= 0 ? path.slice(0, index) : "."
}

function replaceExtension(path: string, extension: string): string {
  return path.replace(/\.[^.]+$/, extension)
}

const SERVER_APP_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"])
const SERVER_APP_IGNORED_DIRS = new Set([".git", ".gorsee", "dist", "node_modules", "public"])

async function compileServerAppForNode(cwd: string, outdir: string): Promise<void> {
  await rm(outdir, { recursive: true, force: true })
  await mkdir(outdir, { recursive: true })

  const entrypoints = await collectServerAppEntrypoints(cwd)
  if (entrypoints.length === 0) return

  for (const entrypoint of entrypoints) {
    const rel = relative(cwd, entrypoint)
    const source = await readFile(entrypoint, "utf-8")
    const rewritten = rewriteServerRuntimeSpecifiers(source, entrypoint)
    const targetPath = join(outdir, replaceExtension(rel, ".js"))
    await mkdir(dirnameOf(targetPath), { recursive: true })
    await writeFile(targetPath, transpileServerRuntimeSource(entrypoint, rewritten), "utf-8")
  }
}

async function collectServerAppEntrypoints(root: string, dir = root): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: string[] = []

  for (const entry of entries) {
    if (SERVER_APP_IGNORED_DIRS.has(entry.name)) continue
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectServerAppEntrypoints(root, fullPath))
      continue
    }

    const extIndex = entry.name.lastIndexOf(".")
    const ext = extIndex >= 0 ? entry.name.slice(extIndex) : ""
    if (!SERVER_APP_EXTENSIONS.has(ext)) continue
    const rel = relative(root, fullPath)
    if (rel.startsWith("tests/") || rel.startsWith("examples/") || rel.startsWith("benchmarks/")) continue
    files.push(fullPath)
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function transpileServerRuntimeSource(path: string, source: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) {
    return ts.transpileModule(source, {
      fileName: path,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: path.endsWith(".tsx") ? ts.JsxEmit.ReactJSX : undefined,
        jsxImportSource: path.endsWith(".tsx") ? "gorsee" : undefined,
      },
    }).outputText
  }
  return source
}

function rewriteServerRuntimeSpecifiers(source: string, filePath: string): string {
  return source.replace(
    /((?:from\s*|import\s*\()\s*["'])(\.\.?\/[^"']+?)(["'])/g,
    (full, prefix: string, specifier: string, suffix: string) => {
      const rewritten = resolveServerRuntimeSpecifier(filePath, specifier)
      return `${prefix}${rewritten}${suffix}`
    },
  )
}

function resolveServerRuntimeSpecifier(filePath: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier
  if (/\.(?:css|json|svg|png|jpg|jpeg|gif|webp|woff2?)$/.test(specifier)) return specifier
  if (/\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/.test(specifier)) return specifier.replace(/\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/, ".js")

  const resolvedBase = resolve(dirnameOf(filePath), specifier)
  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs"]) {
    if (existsSync(`${resolvedBase}${ext}`)) return `${specifier}.js`
  }
  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs"]) {
    if (existsSync(join(resolvedBase, `index${ext}`))) return `${specifier}/index.js`
  }
  return specifier
}
