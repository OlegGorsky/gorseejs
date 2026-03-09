import { readdir, readFile } from "node:fs/promises"
import { extname, join, relative } from "node:path"

export interface ContentEntry<TFrontmatter extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  slug: string
  locale: string | null
  body: string
  excerpt: string
  frontmatter: TFrontmatter
  sourcePath: string
}

export interface ContentCollectionOptions<TFrontmatter extends Record<string, unknown>> {
  dir: string
  includeExtensions?: string[]
  defaultLocale?: string
  validate?: (frontmatter: Record<string, unknown>, entry: Omit<ContentEntry<TFrontmatter>, "frontmatter">) => TFrontmatter
}

export interface ContentQueryOptions {
  locale?: string
  sortBy?: "date-desc" | "date-asc" | "title-asc" | "title-desc"
}

type ParsedBlockResult<TValue> = {
  value: TValue
  nextIndex: number
}

export function parseFrontmatter(source: string): { frontmatter: Record<string, unknown>; body: string } {
  if (!source.startsWith("---\n")) {
    return { frontmatter: {}, body: source }
  }

  const end = source.indexOf("\n---\n", 4)
  if (end === -1) {
    return { frontmatter: {}, body: source }
  }

  const rawFrontmatter = source.slice(4, end)
  const body = source.slice(end + 5)
  const lines = rawFrontmatter.split("\n")
  const { value } = parseObjectBlock(lines, 0, 0)
  return { frontmatter: value, body }
}

export function extractExcerpt(body: string, maxLength = 180): string {
  const clean = body
    .replace(/^#+\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength).trimEnd()}...`
}

function inferSlug(filePath: string): string {
  const withoutExtension = filePath
    .replace(/\.[^.]+$/, "")
    .replace(/\.([a-z]{2}(?:-[A-Z]{2})?)$/, "")
  return withoutExtension
    .replace(/\/index$/, "")
    .replace(/\\/g, "/")
}

function inferLocale(frontmatter: Record<string, unknown>, slug: string, defaultLocale: string): string | null {
  if (typeof frontmatter.locale === "string") return frontmatter.locale
  const firstSegment = slug.split("/")[0] ?? ""
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(firstSegment)) return firstSegment
  return defaultLocale ? defaultLocale : null
}

async function collectFiles(root: string, dir = root): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, fullPath))
      continue
    }
    files.push(fullPath)
  }

  return files
}

export async function loadContentCollection<TFrontmatter extends Record<string, unknown> = Record<string, unknown>>(
  options: ContentCollectionOptions<TFrontmatter>,
): Promise<Array<ContentEntry<TFrontmatter>>> {
  const includeExtensions = options.includeExtensions ?? [".md", ".mdx"]
  const defaultLocale = options.defaultLocale ?? "en"
  const files = (await collectFiles(options.dir)).filter((file) => includeExtensions.includes(extname(file)))
  const entries: Array<ContentEntry<TFrontmatter>> = []

  for (const file of files) {
    const source = await readFile(file, "utf-8")
    const parsed = parseFrontmatter(source)
    const id = relative(options.dir, file).replace(/\\/g, "/")
    const slug = inferSlug(id)
    const locale = inferLocale(parsed.frontmatter, slug, defaultLocale)
    const baseEntry = {
      id,
      slug,
      locale,
      body: parsed.body,
      excerpt: extractExcerpt(parsed.body),
      sourcePath: file,
    }

    const frontmatter = options.validate
      ? options.validate(parsed.frontmatter, baseEntry)
      : parsed.frontmatter as TFrontmatter

    entries.push({ ...baseEntry, frontmatter })
  }

  return entries
}

export function queryContent<TFrontmatter extends Record<string, unknown>>(
  entries: Array<ContentEntry<TFrontmatter>>,
  options: ContentQueryOptions = {},
): Array<ContentEntry<TFrontmatter>> {
  const filtered = options.locale
    ? entries.filter((entry) => entry.locale === options.locale)
    : [...entries]

  const sorted = [...filtered]
  switch (options.sortBy) {
    case "date-asc":
      sorted.sort((a, b) => String(a.frontmatter.date ?? "").localeCompare(String(b.frontmatter.date ?? "")))
      break
    case "date-desc":
      sorted.sort((a, b) => String(b.frontmatter.date ?? "").localeCompare(String(a.frontmatter.date ?? "")))
      break
    case "title-asc":
      sorted.sort((a, b) => String(a.frontmatter.title ?? "").localeCompare(String(b.frontmatter.title ?? "")))
      break
    case "title-desc":
      sorted.sort((a, b) => String(b.frontmatter.title ?? "").localeCompare(String(a.frontmatter.title ?? "")))
      break
  }
  return sorted
}

export function getContentEntryBySlug<TFrontmatter extends Record<string, unknown>>(
  entries: Array<ContentEntry<TFrontmatter>>,
  slug: string,
  locale?: string,
): ContentEntry<TFrontmatter> | null {
  return entries.find((entry) => entry.slug === slug && (locale ? entry.locale === locale : true)) ?? null
}

function parseObjectBlock(lines: string[], startIndex: number, indent: number): ParsedBlockResult<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index] ?? ""
    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1
      continue
    }

    const lineIndent = countIndent(line)
    if (lineIndent < indent) break
    if (lineIndent > indent) {
      index += 1
      continue
    }

    const content = line.slice(indent)
    if (content.startsWith("- ")) break

    const separator = content.indexOf(":")
    if (separator === -1) {
      index += 1
      continue
    }

    const key = content.slice(0, separator).trim()
    const rawValue = content.slice(separator + 1).trim()
    if (!key) {
      index += 1
      continue
    }

    if (rawValue === "|" || rawValue === ">") {
      const block = parseBlockScalar(lines, index + 1, indent, rawValue)
      result[key] = block.value
      index = block.nextIndex
      continue
    }

    if (rawValue) {
      result[key] = parseScalar(rawValue)
      index += 1
      continue
    }

    const next = findNextMeaningfulLine(lines, index + 1)
    if (!next || next.indent <= indent) {
      result[key] = null
      index += 1
      continue
    }

    if (next.content.startsWith("- ")) {
      const sequence = parseArrayBlock(lines, next.index, next.indent)
      result[key] = sequence.value
      index = sequence.nextIndex
      continue
    }

    const object = parseObjectBlock(lines, next.index, next.indent)
    result[key] = object.value
    index = object.nextIndex
  }

  return { value: result, nextIndex: index }
}

function parseArrayBlock(lines: string[], startIndex: number, indent: number): ParsedBlockResult<unknown[]> {
  const result: unknown[] = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index] ?? ""
    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1
      continue
    }

    const lineIndent = countIndent(line)
    if (lineIndent < indent) break
    if (lineIndent !== indent) {
      index += 1
      continue
    }

    const content = line.slice(indent)
    if (!content.startsWith("- ")) break
    const itemContent = content.slice(2).trim()

    if (!itemContent) {
      const next = findNextMeaningfulLine(lines, index + 1)
      if (!next || next.indent <= indent) {
        result.push(null)
        index += 1
        continue
      }
      if (next.content.startsWith("- ")) {
        const nestedArray = parseArrayBlock(lines, next.index, next.indent)
        result.push(nestedArray.value)
        index = nestedArray.nextIndex
        continue
      }
      const nestedObject = parseObjectBlock(lines, next.index, next.indent)
      result.push(nestedObject.value)
      index = nestedObject.nextIndex
      continue
    }

    if (itemContent === "|" || itemContent === ">") {
      const block = parseBlockScalar(lines, index + 1, indent, itemContent)
      result.push(block.value)
      index = block.nextIndex
      continue
    }

    if (looksLikeInlineMapping(itemContent)) {
      const separator = itemContent.indexOf(":")
      const key = itemContent.slice(0, separator).trim()
      const rawValue = itemContent.slice(separator + 1).trim()
      const item: Record<string, unknown> = {
        [key]: rawValue ? parseScalar(rawValue) : null,
      }
      const next = findNextMeaningfulLine(lines, index + 1)
      if (next && next.indent > indent && !next.content.startsWith("- ")) {
        const nested = parseObjectBlock(lines, next.index, next.indent)
        Object.assign(item, nested.value)
        result.push(item)
        index = nested.nextIndex
        continue
      }
      result.push(item)
      index += 1
      continue
    }

    result.push(parseScalar(itemContent))
    index += 1
  }

  return { value: result, nextIndex: index }
}

function parseBlockScalar(
  lines: string[],
  startIndex: number,
  parentIndent: number,
  mode: "|" | ">",
): ParsedBlockResult<string> {
  const first = findNextMeaningfulLine(lines, startIndex)
  if (!first || first.indent <= parentIndent) {
    return { value: "", nextIndex: startIndex }
  }

  const blockIndent = first.indent
  const values: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index] ?? ""
    if (!line.trim()) {
      values.push("")
      index += 1
      continue
    }

    const lineIndent = countIndent(line)
    if (lineIndent < blockIndent) break
    values.push(line.slice(blockIndent))
    index += 1
  }

  return {
    value: mode === "|" ? values.join("\n").trimEnd() : foldBlockScalar(values),
    nextIndex: index,
  }
}

function foldBlockScalar(lines: string[]): string {
  const paragraphs: string[] = []
  let current = ""

  for (const line of lines) {
    if (!line.trim()) {
      if (current) {
        paragraphs.push(current.trim())
        current = ""
      }
      continue
    }
    current = current ? `${current} ${line.trim()}` : line.trim()
  }

  if (current) paragraphs.push(current.trim())
  return paragraphs.join("\n\n")
}

function parseScalar(rawValue: string): unknown {
  const value = rawValue.trim()
  if (!value) return ""
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  if (value === "true") return true
  if (value === "false") return false
  if (value === "null") return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(",")
      .map((item) => parseScalar(item))
      .filter((item) => item !== "")
  }
  return value
}

function countIndent(line: string): number {
  return line.length - line.trimStart().length
}

function findNextMeaningfulLine(
  lines: string[],
  startIndex: number,
): { index: number; indent: number; content: string } | null {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const indent = countIndent(line)
    return {
      index,
      indent,
      content: line.slice(indent),
    }
  }
  return null
}

function looksLikeInlineMapping(value: string): boolean {
  const separator = value.indexOf(":")
  return separator > 0 && !value.startsWith("http://") && !value.startsWith("https://")
}
