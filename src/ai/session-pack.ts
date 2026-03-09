import { mkdir, writeFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import type { AIStorePaths } from "./store.ts"
import { buildAIContextBundle, renderAIContextBundleMarkdown, type AIContextBundle } from "./bundle.ts"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "./contracts.ts"

export interface AISessionPackConfig {
  enabled?: boolean
  outDir?: string
  triggerKinds?: string[]
  debounceMs?: number
  limit?: number
  maxSnippets?: number
  formats?: Array<"json" | "markdown">
}

export interface AISessionPackPaths {
  outDir: string
  latestJsonPath: string
  latestMarkdownPath: string
  historyDir: string
}

export function resolveAISessionPackConfig(cwd: string, config?: AISessionPackConfig): AISessionPackConfig | undefined {
  if (!config?.enabled) return config
  const outDir = config.outDir
    ? (isAbsolute(config.outDir) ? config.outDir : join(cwd, config.outDir))
    : join(cwd, ".gorsee", "agent")
  return {
    enabled: true,
    outDir,
    triggerKinds: config.triggerKinds ?? ["diagnostic.issue", "request.error", "build.summary", "check.summary"],
    debounceMs: config.debounceMs ?? 250,
    limit: config.limit ?? 200,
    maxSnippets: config.maxSnippets ?? 6,
    formats: config.formats ?? ["json", "markdown"],
  }
}

export function resolveAISessionPackPaths(cwd: string, config?: AISessionPackConfig): AISessionPackPaths {
  const outDir = config?.outDir
    ? (isAbsolute(config.outDir) ? config.outDir : join(cwd, config.outDir))
    : join(cwd, ".gorsee", "agent")
  return {
    outDir,
    latestJsonPath: join(outDir, "latest.json"),
    latestMarkdownPath: join(outDir, "latest.md"),
    historyDir: join(outDir, "history"),
  }
}

export async function writeAISessionPack(
  cwd: string,
  storePaths: AIStorePaths,
  config?: AISessionPackConfig,
): Promise<{ bundle: AIContextBundle; paths: AISessionPackPaths; stamp: string }> {
  const resolved = resolveAISessionPackConfig(cwd, { enabled: true, ...(config ?? {}) })!
  const paths = resolveAISessionPackPaths(cwd, resolved)
  const bundle = await buildAIContextBundle(cwd, storePaths, {
    limit: resolved.limit,
    maxSnippets: resolved.maxSnippets,
  })

  await mkdir(paths.historyDir, { recursive: true })
  const stamp = bundle.generatedAt.replace(/[:.]/g, "-")
  const json = JSON.stringify(bundle, null, 2)
  const markdown = [
    `<!-- gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION} -->`,
    renderAIContextBundleMarkdown(bundle),
  ].join("\n")

  if ((resolved.formats ?? ["json", "markdown"]).includes("json")) {
    await writeFile(paths.latestJsonPath, json, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.json`), json, "utf-8")
  }
  if ((resolved.formats ?? ["json", "markdown"]).includes("markdown")) {
    await writeFile(paths.latestMarkdownPath, markdown, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.md`), markdown, "utf-8")
  }

  return { bundle, paths, stamp }
}

export function shouldGenerateAISessionPack(
  event: { kind: string; severity: string },
  config?: AISessionPackConfig,
): boolean {
  if (!config?.enabled) return false
  if ((config.triggerKinds ?? []).includes(event.kind)) {
    if (event.kind.endsWith(".summary")) return event.severity === "error" || event.severity === "warn"
    return true
  }
  return event.severity === "error"
}
