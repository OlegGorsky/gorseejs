import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { CLIENT_SCOPED_IMPORTS, ROOT_SCOPED_IMPORTS, SERVER_SCOPED_IMPORTS } from "./canonical-imports.ts"

const IMPORT_RE = /import\s*\{([\s\S]*?)\}\s*from\s*(["'])(gorsee(?:\/(?:server|client))?)\2/g

export interface CanonicalRewriteResult {
  changed: boolean
  source: string
}

export interface CanonicalRewriteReport {
  changedFiles: string[]
}

export interface LoaderRewriteResult {
  changed: boolean
  source: string
}

export interface LoaderRewriteReport {
  changedFiles: string[]
}

export function rewriteCanonicalImports(source: string): CanonicalRewriteResult {
  let changed = false

  const rewritten = source.replace(IMPORT_RE, (statement, bindings, _quote, specifier: "gorsee" | "gorsee/server" | "gorsee/client") => {
    const scopedMap = specifier === "gorsee"
      ? ROOT_SCOPED_IMPORTS
      : specifier === "gorsee/server"
        ? SERVER_SCOPED_IMPORTS
        : CLIENT_SCOPED_IMPORTS
    const parsed = parseBindings(bindings)
    const kept: string[] = []
    const moved = new Map<string, string[]>()

    for (const binding of parsed) {
      const target = scopedMap.get(binding.importedName)
      if (!target) {
        kept.push(binding.raw)
        continue
      }
      const bucket = moved.get(target) ?? []
      bucket.push(binding.raw)
      moved.set(target, bucket)
    }

    if (moved.size === 0) return statement

    changed = true
    const rewrittenImports: string[] = []
    if (kept.length > 0) {
      rewrittenImports.push(renderImport(specifier === "gorsee" ? "gorsee/compat" : specifier, kept))
    }
    for (const target of [...moved.keys()].sort()) {
      rewrittenImports.push(renderImport(target, moved.get(target) ?? []))
    }
    return rewrittenImports.join("\n")
  })

  return { changed, source: rewritten }
}

export async function rewriteCanonicalImportsInProject(cwd: string): Promise<CanonicalRewriteReport> {
  const sourceFiles = [
    ...(await getAllSourceFiles(cwd, "routes")),
    ...(await getAllSourceFiles(cwd, "shared")),
    ...(await getAllSourceFiles(cwd, "middleware")),
  ]
  const changedFiles: string[] = []

  for (const file of sourceFiles) {
    const source = await readFile(file, "utf-8")
    const rewritten = rewriteCanonicalImports(source)
    if (!rewritten.changed || rewritten.source === source) continue
    await writeFile(file, rewritten.source, "utf-8")
    changedFiles.push(relative(cwd, file))
  }

  changedFiles.sort()
  return { changedFiles }
}

export function rewriteLegacyLoaders(source: string): LoaderRewriteResult {
  const rewritten = source
    .replace(/\bexport\s+async\s+function\s+loader\b/g, "export async function load")
    .replace(/\bexport\s+function\s+loader\b/g, "export function load")
    .replace(/\bexport\s+const\s+loader\b/g, "export const load")

  return { changed: rewritten !== source, source: rewritten }
}

export async function rewriteLegacyLoadersInProject(cwd: string): Promise<LoaderRewriteReport> {
  const sourceFiles = [
    ...(await getAllSourceFiles(cwd, "routes")),
    ...(await getAllSourceFiles(cwd, "shared")),
    ...(await getAllSourceFiles(cwd, "middleware")),
  ]
  const changedFiles: string[] = []

  for (const file of sourceFiles) {
    const source = await readFile(file, "utf-8")
    const rewritten = rewriteLegacyLoaders(source)
    if (!rewritten.changed || rewritten.source === source) continue
    await writeFile(file, rewritten.source, "utf-8")
    changedFiles.push(relative(cwd, file))
  }

  changedFiles.sort()
  return { changedFiles }
}

async function getAllSourceFiles(cwd: string, dir: string): Promise<string[]> {
  const path = join(cwd, dir)
  try {
    const entries = await readdir(path)
    const files: string[] = []
    for (const entry of entries) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue
      const fullPath = join(path, entry)
      const info = await stat(fullPath)
      if (info.isDirectory()) {
        files.push(...(await getAllSourceFiles(cwd, relative(cwd, fullPath))))
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        files.push(fullPath)
      }
    }
    return files
  } catch {
    return []
  }
}

function renderImport(specifier: string, bindings: string[]): string {
  return `import { ${bindings.join(", ")} } from "${specifier}"`
}

function parseBindings(bindings: string): Array<{ raw: string; importedName: string }> {
  return bindings
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((raw) => {
      const withoutType = raw.startsWith("type ") ? raw.slice(5).trim() : raw
      const importedName = withoutType.split(/\s+as\s+/)[0]!.trim()
      return { raw, importedName }
    })
}
