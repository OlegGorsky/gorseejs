import { join } from "node:path"
import { stat } from "node:fs/promises"
import { wrapHTML, type HTMLWrapOptions } from "./html-shell.ts"

interface NotFoundOptions extends Pick<HTMLWrapOptions, "bodyPrefix" | "bodySuffix" | "headElements"> {
  title?: string
}

export async function renderNotFoundPage(
  routesDir: string,
  nonce: string,
  options: NotFoundOptions = {},
): Promise<string> {
  const { title = "404 - Not Found", bodyPrefix, bodySuffix, headElements } = options

  try {
    for (const candidate of ["404.tsx", "404.ts", "404.jsx", "404.js", "404.mjs"]) {
      const notFoundPath = join(routesDir, candidate)
      const fileStat = await stat(notFoundPath).catch(() => null)
      if (!fileStat?.isFile()) continue
      const mod = await import(notFoundPath)
      if (typeof mod.default === "function") {
        const { ssrJsx, renderToString } = await import("../runtime/server.ts")
        const vnode = ssrJsx(mod.default as any, {})
        const body = renderToString(vnode)
        return wrapHTML(body, nonce, { title, bodyPrefix, bodySuffix, headElements })
      }
    }
  } catch {}

  return wrapHTML("<h1>404</h1><p>Page not found</p>", nonce, {
    title,
    bodyPrefix,
    bodySuffix,
    headElements,
  })
}
