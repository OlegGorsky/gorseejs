// CSS Modules plugin for Bun.build
// Transforms .module.css imports to scoped class names
// Input:  import styles from "./button.module.css"
// Output: styles = { container: "button_container_a1b2c" }

import type { BunPlugin } from "bun"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { basename, join, dirname } from "node:path"

function hashClassName(filePath: string, className: string): string {
  const hash = createHash("md5")
    .update(filePath + className)
    .digest("hex")
    .slice(0, 5)
  const base = basename(filePath, ".module.css")
  return `${base}_${className}_${hash}`
}

export function transformCssModuleSource(
  filePath: string,
  source: string,
): { css: string; classMap: Record<string, string> } {
  const classMap: Record<string, string> = {}

  const css = source.replace(/\.([a-zA-Z_][\w-]*)/g, (match, className) => {
    // Don't transform pseudo-classes and pseudo-elements
    if (match.startsWith("::") || match.startsWith(":.")) return match
    const scoped = hashClassName(filePath, className)
    classMap[className] = scoped
    return `.${scoped}`
  })

  return { css, classMap }
}

// Collected CSS from all modules (used during build)
const collectedCSS: string[] = []

export function getCollectedCSS(): string {
  return collectedCSS.join("\n")
}

export function resetCollectedCSS(): void {
  collectedCSS.length = 0
}

export function collectCssModule(css: string): void {
  collectedCSS.push(css)
}

export function renderCssModuleExports(classMap: Record<string, string>): string {
  const exports = Object.entries(classMap)
    .map(([k, v]) => `  "${k}": "${v}"`)
    .join(",\n")

  return `export default {\n${exports}\n};`
}

export const cssModulesPlugin: BunPlugin = {
  name: "gorsee-css-modules",
  setup(build) {
    build.onResolve({ filter: /\.module\.css$/ }, (args) => ({
      path: join(dirname(args.importer), args.path),
      namespace: "css-module",
    }))

    build.onLoad({ filter: /.*/, namespace: "css-module" }, async (args) => {
      const source = await readFile(args.path, "utf-8")
      const { css, classMap } = transformCssModuleSource(args.path, source)
      collectCssModule(css)

      return {
        contents: renderCssModuleExports(classMap),
        loader: "js",
      }
    })
  },
}
