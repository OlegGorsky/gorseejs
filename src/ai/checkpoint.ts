import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildAIContextBundle, renderAIContextBundleMarkdown, type AIContextBundle } from "./bundle.ts"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "./contracts.ts"
import { resolveAISessionPackPaths } from "./session-pack.ts"
import type { AIStorePaths } from "./store.ts"
import {
  AI_TRANSPORT_CONTRACT,
  type AIOperationMode,
  type AITransportContract,
  resolveAIRulesFile,
} from "./rules.ts"

export interface AICheckpointMetadata {
  schemaVersion: string
  createdAt: string
  name: string
  slug: string
  mode: AIOperationMode
  bundleJsonPath: string
  bundleMarkdownPath: string
  rulesPath?: string
  transport: AITransportContract
}

export interface AICheckpointPaths {
  checkpointsDir: string
  bundleJsonPath: string
  bundleMarkdownPath: string
  metadataPath: string
  latestPointerPath: string
}

export function slugifyCheckpointName(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "checkpoint"
}

export function resolveAICheckpointPaths(cwd: string, name: string): AICheckpointPaths {
  const sessionPackPaths = resolveAISessionPackPaths(cwd)
  const checkpointsDir = join(sessionPackPaths.outDir, "checkpoints")
  const slug = slugifyCheckpointName(name)
  return {
    checkpointsDir,
    bundleJsonPath: join(checkpointsDir, `${slug}.json`),
    bundleMarkdownPath: join(checkpointsDir, `${slug}.md`),
    metadataPath: join(checkpointsDir, `${slug}.meta.json`),
    latestPointerPath: join(checkpointsDir, "latest.json"),
  }
}

export async function writeAICheckpoint(
  cwd: string,
  storePaths: AIStorePaths,
  options: {
    name?: string
    mode: AIOperationMode
    limit?: number
    maxSnippets?: number
  },
): Promise<{
  bundle: AIContextBundle
  metadata: AICheckpointMetadata
  paths: AICheckpointPaths
}> {
  const createdAt = new Date().toISOString()
  const name = options.name?.trim().length ? options.name.trim() : createdAt.replace(/[:.]/g, "-")
  const paths = resolveAICheckpointPaths(cwd, name)
  const bundle = await buildAIContextBundle(cwd, storePaths, {
    limit: options.limit,
    maxSnippets: options.maxSnippets,
  })
  const rules = await resolveAIRulesFile(cwd)

  await mkdir(paths.checkpointsDir, { recursive: true })

  const metadata: AICheckpointMetadata = {
    schemaVersion: GORSEE_AI_CONTEXT_SCHEMA_VERSION,
    createdAt,
    name,
    slug: slugifyCheckpointName(name),
    mode: options.mode,
    bundleJsonPath: paths.bundleJsonPath,
    bundleMarkdownPath: paths.bundleMarkdownPath,
    rulesPath: rules?.path,
    transport: AI_TRANSPORT_CONTRACT,
  }

  const markdown = [
    `<!-- gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION} -->`,
    `<!-- gorsee-ai-mode: ${options.mode} -->`,
    renderAIContextBundleMarkdown(bundle),
  ].join("\n")

  await writeFile(paths.bundleJsonPath, JSON.stringify(bundle, null, 2), "utf-8")
  await writeFile(paths.bundleMarkdownPath, markdown, "utf-8")
  await writeFile(paths.metadataPath, JSON.stringify(metadata, null, 2), "utf-8")
  await writeFile(paths.latestPointerPath, JSON.stringify(metadata, null, 2), "utf-8")

  return { bundle, metadata, paths }
}
