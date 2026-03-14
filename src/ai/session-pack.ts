import { mkdir, writeFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import type { AIStorePaths } from "./store.ts"
import { buildAIContextBundle, renderAIContextBundleMarkdown, type AIContextBundle } from "./bundle.ts"
import { GORSEE_AI_CONTEXT_SCHEMA_VERSION } from "./contracts.ts"
import type { AIOperationMode } from "./rules.ts"
import {
  createAIDeploySummary,
  createAIIncidentBrief,
  createAIIncidentSnapshot,
  createAIReleaseBrief,
  renderAIDeploySummaryMarkdown,
  renderAIIncidentBriefMarkdown,
  renderAIIncidentSnapshotMarkdown,
  renderAIReleaseBriefMarkdown,
} from "./summary.ts"

export interface AISessionPackConfig {
  enabled?: boolean
  outDir?: string
  triggerKinds?: string[]
  debounceMs?: number
  limit?: number
  maxSnippets?: number
  formats?: Array<"json" | "markdown">
  mode?: AIOperationMode
}

export interface AISessionPackPaths {
  outDir: string
  latestJsonPath: string
  latestMarkdownPath: string
  latestReleaseBriefJsonPath: string
  latestReleaseBriefMarkdownPath: string
  latestIncidentBriefJsonPath: string
  latestIncidentBriefMarkdownPath: string
  latestDeploySummaryJsonPath: string
  latestDeploySummaryMarkdownPath: string
  latestIncidentSnapshotJsonPath: string
  latestIncidentSnapshotMarkdownPath: string
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
    latestReleaseBriefJsonPath: join(outDir, "release-brief.json"),
    latestReleaseBriefMarkdownPath: join(outDir, "release-brief.md"),
    latestIncidentBriefJsonPath: join(outDir, "incident-brief.json"),
    latestIncidentBriefMarkdownPath: join(outDir, "incident-brief.md"),
    latestDeploySummaryJsonPath: join(outDir, "deploy-summary.json"),
    latestDeploySummaryMarkdownPath: join(outDir, "deploy-summary.md"),
    latestIncidentSnapshotJsonPath: join(outDir, "incident-snapshot.json"),
    latestIncidentSnapshotMarkdownPath: join(outDir, "incident-snapshot.md"),
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
    mode: resolved.mode,
  })

  await mkdir(paths.historyDir, { recursive: true })
  const stamp = bundle.generatedAt.replace(/[:.]/g, "-")
  const deploySummary = createAIDeploySummary(bundle.packet)
  const releaseBrief = createAIReleaseBrief(bundle.packet)
  const incidentBrief = createAIIncidentBrief(bundle.packet)
  const incidentSnapshot = createAIIncidentSnapshot(bundle.packet)
  const json = JSON.stringify(bundle, null, 2)
  const markdown = [
    `<!-- gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION} -->`,
    renderAIContextBundleMarkdown(bundle),
  ].join("\n")
  const releaseBriefJson = JSON.stringify(releaseBrief, null, 2)
  const deploySummaryJson = JSON.stringify(deploySummary, null, 2)
  const deploySummaryMarkdown = [
    `<!-- gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION} -->`,
    renderAIDeploySummaryMarkdown(deploySummary),
  ].join("\n")
  const releaseBriefMarkdown = [
    `<!-- gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION} -->`,
    renderAIReleaseBriefMarkdown(releaseBrief),
  ].join("\n")
  const incidentBriefJson = JSON.stringify(incidentBrief, null, 2)
  const incidentBriefMarkdown = [
    `<!-- gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION} -->`,
    renderAIIncidentBriefMarkdown(incidentBrief),
  ].join("\n")
  const incidentSnapshotJson = JSON.stringify(incidentSnapshot, null, 2)
  const incidentSnapshotMarkdown = [
    `<!-- gorsee-ai-schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION} -->`,
    renderAIIncidentSnapshotMarkdown(incidentSnapshot),
  ].join("\n")

  if ((resolved.formats ?? ["json", "markdown"]).includes("json")) {
    await writeFile(paths.latestJsonPath, json, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.json`), json, "utf-8")
    await writeFile(paths.latestDeploySummaryJsonPath, deploySummaryJson, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.deploy-summary.json`), deploySummaryJson, "utf-8")
    await writeFile(paths.latestReleaseBriefJsonPath, releaseBriefJson, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.release-brief.json`), releaseBriefJson, "utf-8")
    await writeFile(paths.latestIncidentBriefJsonPath, incidentBriefJson, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.incident-brief.json`), incidentBriefJson, "utf-8")
    await writeFile(paths.latestIncidentSnapshotJsonPath, incidentSnapshotJson, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.incident-snapshot.json`), incidentSnapshotJson, "utf-8")
  }
  if ((resolved.formats ?? ["json", "markdown"]).includes("markdown")) {
    await writeFile(paths.latestMarkdownPath, markdown, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.md`), markdown, "utf-8")
    await writeFile(paths.latestDeploySummaryMarkdownPath, deploySummaryMarkdown, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.deploy-summary.md`), deploySummaryMarkdown, "utf-8")
    await writeFile(paths.latestReleaseBriefMarkdownPath, releaseBriefMarkdown, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.release-brief.md`), releaseBriefMarkdown, "utf-8")
    await writeFile(paths.latestIncidentBriefMarkdownPath, incidentBriefMarkdown, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.incident-brief.md`), incidentBriefMarkdown, "utf-8")
    await writeFile(paths.latestIncidentSnapshotMarkdownPath, incidentSnapshotMarkdown, "utf-8")
    await writeFile(join(paths.historyDir, `${stamp}.incident-snapshot.md`), incidentSnapshotMarkdown, "utf-8")
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
