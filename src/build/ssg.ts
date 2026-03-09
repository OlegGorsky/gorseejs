// Static Site Generation -- pre-renders pages at build time
// Routes with `export const prerender = true` are rendered to static HTML

import { createRouter } from "../router/scanner.ts"
import { createContext } from "../server/middleware.ts"
import { renderPageDocument, resolvePageRoute } from "../server/page-render.ts"
import { wrapHTML, type HTMLWrapOptions } from "../server/html-shell.ts"
import { join } from "node:path"
import { mkdir, writeFile } from "node:fs/promises"

export interface SSGResult {
  pages: Map<string, string>  // path → HTML content
  errors: string[]
}

interface SSGOptions {
  routesDir: string
  outDir: string
  wrapHTML?: (body: string, options?: HTMLWrapOptions) => string
}

export async function generateStaticPages(options: SSGOptions): Promise<SSGResult> {
  const { routesDir, outDir, wrapHTML } = options
  const routes = await createRouter(routesDir)
  const pages = new Map<string, string>()
  const errors: string[] = []

  for (const route of routes) {
    if (route.isDynamic) continue

    try {
      const mod = await import(route.filePath)

      // Skip routes that don't opt-in to prerendering
      if (!mod.prerender) continue

      const fakeRequest = new Request(`http://localhost${route.path}`)
      const ctx = createContext(fakeRequest, {})
      const match = { route, params: {} }
      const resolved = await resolvePageRoute(mod, match, ctx)
      if (!resolved) continue

      const rendered = renderPageDocument(resolved.pageComponent, ctx, {}, resolved.loaderData)
      const renderHTML = wrapHTML ?? defaultWrapHTML
      const html = renderHTML(rendered.html, {
        title: rendered.title,
        loaderData: resolved.loaderData,
        headElements: rendered.headElements,
        cssFiles: resolved.cssFiles,
      })

      // Write file
      const outPath = route.path === "/"
        ? join(outDir, "index.html")
        : join(outDir, route.path, "index.html")
      await mkdir(join(outPath, ".."), { recursive: true })
      await writeFile(outPath, html)

      pages.set(route.path, outPath)
    } catch (err) {
      errors.push(`${route.path}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { pages, errors }
}

function defaultWrapHTML(body: string, options: HTMLWrapOptions = {}): string {
  return wrapHTML(body, undefined, options)
}
