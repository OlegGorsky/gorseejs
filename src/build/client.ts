// Client bundle builder -- creates browser-ready JS per route via a pluggable build backend

import { join, relative } from "node:path"
import { mkdir, rm } from "node:fs/promises"
import { serverStripPlugin } from "./server-strip.ts"
import { cssModulesPlugin, getCollectedCSS, resetCollectedCSS } from "./css-modules.ts"
import { getClientBuildBackend, type ClientBuildBackend } from "./client-backend.ts"
import { defineBuildPlugin } from "./plugin.ts"
import { formatClientBuildLog, normalizeClientBuildLog, summarizeClientBuildFailure } from "./diagnostics.ts"
import { resolveClientFrameworkImport } from "./framework-imports.ts"
import type { Route } from "../router/scanner.ts"

function routeToEntryName(route: Route, cwd: string): string {
  const rel = relative(join(cwd, "routes"), route.filePath)
  return rel.replace(/\.(tsx?|jsx?)$/, "").replace(/[\[\]]/g, "_")
}

function generateEntryCode(route: Route): string {
  const layoutImports = route.layoutPaths
    .map((layoutPath, index) => `import Layout${index} from "gorsee:route:${layoutPath}";`)
    .join("\n")
  const composeLayouts = route.layoutPaths.length > 0
    ? `
function composeComponentTree(props) {
  let tree = () => Component(props);
  ${route.layoutPaths.map((_, index) => index).reverse().map((index) => `if (typeof Layout${index} === "function") {
    const inner = tree;
    tree = () => Layout${index}({ ...props, data: undefined, children: inner });
  }`).join("\n  ")}
  return tree();
}
`
    : `
function composeComponentTree(props) {
  return Component(props);
}
`

  return `
import Component from "gorsee:route:${route.filePath}";
${layoutImports}
import { hydrate, initRouter } from "gorsee/runtime";
${composeLayouts}
export default composeComponentTree;

if (!globalThis.__GORSEE_SUPPRESS_ENTRY_BOOTSTRAP__) {
  globalThis.__GORSEE_ROUTE_SCRIPT__ = new URL(import.meta.url).pathname;
  var container = document.getElementById("app");
  var dataEl = document.getElementById("__GORSEE_DATA__");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  var params = window.__GORSEE_PARAMS__ || {};
  hydrate(function() { return composeComponentTree({ data: data, params: params }); }, container);
  initRouter();
}
`
}

export interface BuildResult {
  entryMap: Map<string, string>  // routePath → client JS path (relative to outdir)
  cssModules?: string  // collected CSS from .module.css files
}

export interface BuildOptions {
  minify?: boolean
  sourcemap?: boolean
  backend?: ClientBuildBackend
}

export async function buildClientBundles(
  routes: Route[],
  cwd: string,
  options?: BuildOptions,
): Promise<BuildResult> {
  const outDir = join(cwd, ".gorsee", "client")
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const entryDir = join(cwd, ".gorsee", "entries")
  await rm(entryDir, { recursive: true, force: true })
  await mkdir(entryDir, { recursive: true })

  const entryMap = new Map<string, string>()
  const pageRoutes = routes.filter((r) => !r.filePath.includes("/api/"))
  if (pageRoutes.length === 0) return { entryMap }

  resetCollectedCSS()

  const entrypoints: string[] = []
  const backend = options?.backend ?? getClientBuildBackend()

  for (const route of pageRoutes) {
    const name = routeToEntryName(route, cwd)
    const entryPath = join(entryDir, `${name}.ts`)
    const code = generateEntryCode(route)
    await Bun.write(entryPath, code)
    entrypoints.push(entryPath)
    entryMap.set(route.path, `${name}.js`)
  }

  const result = await backend.build({
    entrypoints,
    outdir: outDir,
    minify: options?.minify ?? false,
    sourcemap: options?.sourcemap ?? false,
    frameworkResolve: resolveClientFrameworkImport,
    plugins: [
      defineBuildPlugin({ name: serverStripPlugin.name, bun: serverStripPlugin }),
      defineBuildPlugin({ name: cssModulesPlugin.name, bun: cssModulesPlugin }),
    ],
  })

  if (!result.success) {
    const diagnostics = (result.logs.length > 0 ? result.logs : [{
      message: "backend reported unsuccessful result without diagnostics",
    }]).map((log) => normalizeClientBuildLog(log, {
      backend: backend.name,
      phase: "bundle",
      severity: "error",
      code: "BUILD_BACKEND_FAILURE",
    }))
    for (const log of diagnostics) {
      console.error("[build]", formatClientBuildLog(log))
    }
    throw new Error(summarizeClientBuildFailure(backend.name, diagnostics))
  }

  // Write collected CSS modules output
  const cssModules = getCollectedCSS()
  if (cssModules) {
    await Bun.write(join(outDir, "modules.css"), cssModules)
  }

  return { entryMap, cssModules }
}
