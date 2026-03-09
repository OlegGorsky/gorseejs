import { readdir, readFile, rename } from "node:fs/promises"
import { dirname, extname, resolve, sep } from "node:path"
import { build, type Plugin } from "rolldown"
import ts from "typescript"
import type { ClientBuildBackend, ClientBuildBackendOptions, ClientBuildBackendResult } from "../client-backend.ts"
import { normalizeClientBuildLog, type ClientBuildLog } from "../diagnostics.ts"
import { resolveBuildPluginsForTarget } from "../plugin.ts"
import {
  collectCssModule,
  renderCssModuleExports,
  transformCssModuleSource,
} from "../css-modules.ts"
import {
  applyRouteClientTransforms,
  SERVER_ONLY_MODULES,
  SERVER_STUB_MODULES,
} from "../route-client-transform.ts"

export const ROLLDOWN_BACKEND_NAME = "rolldown"
export const ROLLDOWN_PACKAGE = "rolldown"
const EMPTY_NAMESPACE = "\0gorsee-empty:"
const STUB_NAMESPACE = "\0gorsee-stub:"
const CSS_MODULE_NAMESPACE = "\0gorsee-css-module:"
const CSS_MODULE_IMPORT_PREFIX = "gorsee:css-module:"

export interface RolldownBackendState {
  backend: typeof ROLLDOWN_BACKEND_NAME
  packageName: typeof ROLLDOWN_PACKAGE
  implementation: "rolldown"
  available: true
  fallbackBackend: string
  reason: null
}

export interface RolldownBackendOptions {
  fallback: ClientBuildBackend
}

export function createRolldownClientBuildBackend(
  options: RolldownBackendOptions,
): ClientBuildBackend {
  return {
    name: ROLLDOWN_BACKEND_NAME,
    async build(buildOptions: ClientBuildBackendOptions): Promise<ClientBuildBackendResult> {
      try {
        const namedInput = Object.fromEntries(
          buildOptions.entrypoints.map((entrypoint) => [
            resolveRolldownEntryName(entrypoint),
            resolve(entrypoint),
          ]),
        )
        await build({
          input: namedInput,
          platform: "browser",
          plugins: createRolldownPlugins(buildOptions),
          output: {
            dir: resolve(buildOptions.outdir),
            format: "esm",
            sourcemap: buildOptions.sourcemap,
            minify: buildOptions.minify ? { compress: true, mangle: true } : false,
            entryFileNames: "[name].js",
            chunkFileNames: "chunks/[name].js",
          },
        })
        await normalizeRolldownChunkPaths(buildOptions.outdir)

        return {
          success: true,
          logs: [],
        }
      } catch (error) {
        const diagnostic = extractRolldownDiagnostic(error)
        return {
          success: false,
          logs: [diagnostic],
        }
      }
    },
  }
}

async function normalizeRolldownChunkPaths(outdir: string): Promise<void> {
  const chunkDir = resolve(outdir, "chunks")
  const entries = await readdir(chunkDir, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith(".js")) continue
    const normalizedName = entry.name.replace(/\.[a-f0-9]{8}(?=\.js$)/, "")
    if (normalizedName === entry.name) continue
    await rename(resolve(chunkDir, entry.name), resolve(chunkDir, normalizedName))
  }
}

export function getRolldownBackendState(
  options: RolldownBackendOptions,
): RolldownBackendState {
  return {
    backend: ROLLDOWN_BACKEND_NAME,
    packageName: ROLLDOWN_PACKAGE,
    implementation: "rolldown",
    available: true,
    fallbackBackend: options.fallback.name,
    reason: null,
  }
}

function createRolldownPlugins(options: ClientBuildBackendOptions): Plugin[] {
  const cssModuleIds = new Map<string, string>()
  let cssModuleCounter = 0

  function registerCssModulePath(filePath: string): string {
    const id = String(cssModuleCounter++)
    cssModuleIds.set(id, filePath)
    return id
  }

  function resolveCssModulePath(id: string): string {
    const filePath = cssModuleIds.get(id)
    if (!filePath) {
      throw new Error(`Unknown rolldown CSS module id: ${id}`)
    }
    return filePath
  }

  function rewriteCssModuleImports(source: string, importer: string): string {
    return source.replace(
      /(["'])([^"']+\.module\.css)\1/g,
      (_match, quote: string, specifier: string) => {
        const filePath = resolve(dirname(importer), specifier)
        const id = registerCssModulePath(filePath)
        return `${quote}${CSS_MODULE_IMPORT_PREFIX}${id}${quote}`
      },
    )
  }

  return [
    {
      name: "gorsee-rolldown-resolve",
      resolveId(source, importer) {
        if (source.startsWith("gorsee:route:")) {
          return source.slice("gorsee:route:".length)
        }

        if (source.startsWith(CSS_MODULE_IMPORT_PREFIX)) {
          return `${CSS_MODULE_NAMESPACE}${source.slice(CSS_MODULE_IMPORT_PREFIX.length)}`
        }

        if (source === "react/jsx-runtime") {
          return options.frameworkResolve("gorsee/jsx-runtime") ?? source
        }

        if (source === "react/jsx-dev-runtime") {
          return options.frameworkResolve("gorsee/jsx-dev-runtime") ?? source
        }

        const frameworkImport = options.frameworkResolve(source)
        if (frameworkImport) return frameworkImport

        if (SERVER_ONLY_MODULES.includes(source as (typeof SERVER_ONLY_MODULES)[number])) {
          return `${EMPTY_NAMESPACE}${source}`
        }

        if (source in SERVER_STUB_MODULES) {
          return `${STUB_NAMESPACE}${source}`
        }

        return null
      },
      async load(id) {
        if (id.startsWith(EMPTY_NAMESPACE)) {
          return "export default {}"
        }

        if (id.startsWith(STUB_NAMESPACE)) {
          return SERVER_STUB_MODULES[id.slice(STUB_NAMESPACE.length)] ?? "export default {}"
        }

        if (id.startsWith(CSS_MODULE_NAMESPACE)) {
          const filePath = resolveCssModulePath(id.slice(CSS_MODULE_NAMESPACE.length))
          const source = await readFile(filePath, "utf8")
          const { css, classMap } = transformCssModuleSource(filePath, source)
          collectCssModule(css)
          return renderCssModuleExports(classMap)
        }

        if (isLoadableSourceModule(id)) {
          const source = await readFile(id, "utf8")
          const rewritten = rewriteCssModuleImports(source, id)
          if (/[/\\]routes[/\\].*\.[jt]sx?$/.test(id)) {
            return transpileSourceModule(applyRouteClientTransforms(rewritten, id).source, id)
          }
          return transpileSourceModule(rewritten, id)
        }

        return null
      },
    },
    ...resolveBuildPluginsForTarget(options.plugins, "rolldown"),
  ]
}

function isLoadableSourceModule(id: string): boolean {
  return /\.(?:[cm]?[jt]sx?)$/.test(id) && !id.includes("/node_modules/")
}

function transpileSourceModule(source: string, filePath: string): string {
  const extension = extname(filePath)
  const jsx = extension === ".tsx" || extension === ".jsx" ? ts.JsxEmit.ReactJSX : ts.JsxEmit.Preserve
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx,
      jsxImportSource: "gorsee",
    },
    fileName: filePath,
  }).outputText
}

function resolveRolldownEntryName(entrypoint: string): string {
  const normalized = resolve(entrypoint)
  const marker = `${sep}.gorsee${sep}entries${sep}`
  const index = normalized.indexOf(marker)
  if (index >= 0) {
    return normalized.slice(index + marker.length).replace(/\.[cm]?[jt]sx?$/, "")
  }
  return normalized.split(sep).at(-1)?.replace(/\.[cm]?[jt]sx?$/, "") ?? "entry"
}

function extractRolldownDiagnostic(error: unknown): ClientBuildLog {
  const shape = error as {
    message?: unknown
    code?: unknown
    id?: unknown
    filename?: unknown
    plugin?: unknown
    frame?: unknown
    cause?: unknown
    loc?: { file?: unknown }
  }
  const message = typeof shape?.message === "string"
    ? shape.message
    : error instanceof Error
      ? error.message
      : String(error)
  const file = typeof shape?.id === "string"
    ? shape.id
    : typeof shape?.filename === "string"
      ? shape.filename
      : typeof shape?.loc?.file === "string"
        ? shape.loc.file
        : undefined
  const detail = typeof shape?.frame === "string"
    ? shape.frame
    : shape?.cause instanceof Error
      ? shape.cause.message
      : undefined

  return normalizeClientBuildLog({
    message,
    file,
    plugin: typeof shape?.plugin === "string" ? shape.plugin : undefined,
    detail,
    code: typeof shape?.code === "string" ? shape.code : undefined,
  }, {
    backend: ROLLDOWN_BACKEND_NAME,
    phase: "bundle",
    severity: "error",
    code: "ROLLDOWN_BUILD_FAILURE",
  })
}
