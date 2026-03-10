import { access, readFile } from "node:fs/promises"
import { basename, join, relative } from "node:path"
import { generateFrameworkMD } from "../cli/framework-md.ts"
import { loadAppConfig, resolveAppMode, type AppMode } from "../runtime/app-config.ts"

export interface AIFrameworkDocRef {
  path: string
  purpose: string
}

export interface AIFrameworkPacket {
  kind: "gorsee.framework"
  schemaVersion: 1
  generatedAt: string
  cwd: string
  projectName: string
  appMode: AppMode
  product: {
    name: "Gorsee"
    version?: string
    identity: string
    maturity: string
  }
  entrypoints: {
    browser: string
    server: string
    compatibility: string
    scoped: string[]
  }
  routeGrammar: string[]
  syntax: {
    browserImports: string
    serverImports: string
    routeExample: string
  }
  aiCommands: Array<{ command: string; purpose: string }>
  docs: {
    local: AIFrameworkDocRef[]
    canonical: AIFrameworkDocRef[]
  }
  recommendedStart: string[]
  frameworkReferencePath?: string
  frameworkReferenceMarkdown: string
}

const LOCAL_DOCS: AIFrameworkDocRef[] = [
  { path: "AGENTS.md", purpose: "Проектный operating contract для агентов" },
  { path: "FRAMEWORK.md", purpose: "AI-friendly reference для текущего приложения" },
  { path: "README.md", purpose: "Быстрый вход и публичная поверхность" },
]

const CANONICAL_DOCS: AIFrameworkDocRef[] = [
  { path: "docs/FRAMEWORK_DOCTRINE.md", purpose: "Архитектурная доктрина и инварианты" },
  { path: "docs/APPLICATION_MODES.md", purpose: "Канонические режимы frontend/fullstack/server и границы между ними" },
  { path: "docs/API_STABILITY.md", purpose: "Стабильные публичные entrypoints и migration semantics" },
  { path: "docs/SECURITY_MODEL.md", purpose: "Runtime/security guarantees и fail-closed модель" },
  { path: "docs/AI_WORKFLOWS.md", purpose: "Канонический human+agent workflow" },
  { path: "docs/AI_SURFACE_STABILITY.md", purpose: "Стабильность AI-facing surface" },
  { path: "docs/AI_SESSION_PACKS.md", purpose: "Cross-session handoff для агентов" },
  { path: "docs/STARTER_ONBOARDING.md", purpose: "Стартовые app-классы и onboarding path" },
  { path: "docs/MIGRATION_GUIDE.md", purpose: "Переход с compatibility imports на canonical surfaces" },
  { path: "docs/RUNTIME_TRIAGE.md", purpose: "Триаж runtime/regression проблем" },
  { path: "docs/STARTER_FAILURES.md", purpose: "Частые ошибки установки и scaffold" },
]

const AI_COMMANDS: Array<{ command: string; purpose: string }> = [
  { command: "gorsee ai framework --format markdown", purpose: "Канонический cold-start packet по фреймворку" },
  { command: "gorsee ai export --format markdown", purpose: "Компактный packet по текущему AI/runtime состоянию" },
  { command: "gorsee ai export --bundle --format markdown", purpose: "Runtime packet с ранжированными code snippets" },
  { command: "gorsee ai doctor", purpose: "Сводка diagnostics/incidents/artifact regressions" },
  { command: "gorsee ai pack", purpose: "Запись session pack в .gorsee/agent" },
  { command: "gorsee ai ide-sync", purpose: "IDE-friendly projection файлов" },
  { command: "gorsee ai mcp", purpose: "stdio MCP сервер поверх локального AI state" },
]

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readJSON(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>
  } catch {
    return undefined
  }
}

async function resolveFrameworkVersion(): Promise<string | undefined> {
  for (const candidate of [
    join(import.meta.dir, "..", "..", "package.json"),
    join(import.meta.dir, "..", "package.json"),
  ]) {
    const pkg = await readJSON(candidate)
    if (typeof pkg?.version === "string") return pkg.version
  }
  return undefined
}

async function resolveProjectName(cwd: string): Promise<string> {
  const pkg = await readJSON(join(cwd, "package.json"))
  if (typeof pkg?.name === "string" && pkg.name.trim().length > 0) return pkg.name
  return basename(cwd)
}

async function collectDocRefs(cwd: string, refs: AIFrameworkDocRef[]): Promise<AIFrameworkDocRef[]> {
  const result: AIFrameworkDocRef[] = []
  for (const ref of refs) {
    if (await pathExists(join(cwd, ref.path))) result.push(ref)
  }
  return result
}

function renderDocLines(docs: AIFrameworkDocRef[]): string[] {
  return docs.map((doc) => `- \`${doc.path}\` -- ${doc.purpose}`)
}

export async function buildAIFrameworkPacket(cwd: string): Promise<AIFrameworkPacket> {
  const projectName = await resolveProjectName(cwd)
  const appMode = resolveAppMode(await loadAppConfig(cwd))
  const localDocs = await collectDocRefs(cwd, LOCAL_DOCS)
  const canonicalDocs = await collectDocRefs(cwd, CANONICAL_DOCS)
  const frameworkReferencePath = await pathExists(join(cwd, "FRAMEWORK.md"))
    ? relative(cwd, join(cwd, "FRAMEWORK.md")) || "FRAMEWORK.md"
    : undefined
  const frameworkReferenceMarkdown = frameworkReferencePath
    ? await readFile(join(cwd, frameworkReferencePath), "utf-8")
    : generateFrameworkMD(projectName)

  return {
    kind: "gorsee.framework",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    cwd,
    projectName,
    appMode,
    product: {
      name: "Gorsee",
      version: await resolveFrameworkVersion(),
      identity: "AI-first reactive full-stack framework for deterministic human and agent collaboration",
      maturity: "Mature product framework with strict runtime, security, release, and AI workflow contracts",
    },
    entrypoints: {
      browser: "gorsee/client",
      server: "gorsee/server",
      compatibility: "gorsee and gorsee/compat are compatibility-only for new code",
      scoped: ["gorsee/auth", "gorsee/db", "gorsee/security", "gorsee/log", "gorsee/forms", "gorsee/routes", "gorsee/ai"],
    },
    routeGrammar: [
      "default export -> page UI",
      "load -> route data reads",
      "action -> page-bound mutations",
      "cache -> declarative cache policy",
      "middleware -> request policy and cross-cutting guards",
      "GET/POST/etc -> raw HTTP endpoints",
    ],
    syntax: {
      browserImports: 'import { createSignal, Head, Link } from "gorsee/client"',
      serverImports: 'import { middleware, type Context } from "gorsee/server"',
      routeExample: "routes/users/[id].tsx -> /users/:id",
    },
    aiCommands: AI_COMMANDS,
    docs: {
      local: localDocs,
      canonical: canonicalDocs,
    },
    recommendedStart: [
      "Read AGENTS.md first when it exists.",
      "Read FRAMEWORK.md for the current app shape and syntax.",
      `Respect the current app.mode contract: ${appMode}.`,
      "Use gorsee/client for browser-safe code and gorsee/server for runtime/server boundaries.",
      "Prefer scoped stable subpaths when auth, db, security, forms, routes, ai, or log is the primary concern.",
      "Use gorsee ai export --bundle for incident/debug context, not for framework cold-start context.",
    ],
    frameworkReferencePath,
    frameworkReferenceMarkdown,
  }
}

export function renderAIFrameworkMarkdown(packet: AIFrameworkPacket): string {
  const lines = [
    "# Gorsee AI Framework Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Project: ${packet.projectName}`,
    `App Mode: ${packet.appMode}`,
    packet.product.version ? `Framework Version: ${packet.product.version}` : undefined,
    "",
    "## Product",
    "",
    `- ${packet.product.identity}`,
    `- ${packet.product.maturity}`,
    "",
    "## Canonical Entrypoints",
    "",
    `- browser: \`${packet.entrypoints.browser}\``,
    `- server: \`${packet.entrypoints.server}\``,
    `- compatibility: ${packet.entrypoints.compatibility}`,
    `- scoped: ${packet.entrypoints.scoped.map((entry) => `\`${entry}\``).join(", ")}`,
    "",
    "## Route Grammar",
    "",
    ...packet.routeGrammar.map((entry) => `- ${entry}`),
    "",
    "## Syntax",
    "",
    `- ${packet.syntax.browserImports}`,
    `- ${packet.syntax.serverImports}`,
    `- ${packet.syntax.routeExample}`,
    "",
    "## Recommended Start",
    "",
    ...packet.recommendedStart.map((entry) => `- ${entry}`),
    "",
    "## AI Commands",
    "",
    ...packet.aiCommands.map((entry) => `- \`${entry.command}\` -- ${entry.purpose}`),
    "",
    "## Local Docs",
    "",
    ...(packet.docs.local.length > 0 ? renderDocLines(packet.docs.local) : ["- No local AI/context docs detected in the current cwd."]),
    "",
    "## Canonical Docs",
    "",
    ...(packet.docs.canonical.length > 0 ? renderDocLines(packet.docs.canonical) : ["- Canonical repo docs are not present in the current cwd."]),
    "",
    "## Framework Reference",
    "",
    packet.frameworkReferencePath
      ? `Source: \`${packet.frameworkReferencePath}\``
      : "Source: generated built-in framework reference",
    "",
    packet.frameworkReferenceMarkdown,
  ]

  return lines.filter((line) => line !== undefined).join("\n")
}
