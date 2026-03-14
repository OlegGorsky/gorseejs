import { access, readFile } from "node:fs/promises"
import { basename, join, relative } from "node:path"
import { generateFrameworkMD } from "../cli/framework-md.ts"
import { loadAppConfig, resolveAppMode, type AppMode } from "../runtime/app-config.ts"
import {
  AI_OPERATION_MODES,
  AI_TRANSPORT_CONTRACT,
  resolveAIRulesFile,
  type AIOperationModeDefinition,
  type AITransportContract,
} from "./rules.ts"

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
  cli: {
    topLevelCommands: Array<{ command: string; stability: string; purpose: string }>
    aiSubcommands: Array<{ command: string; stability: string; purpose: string }>
  }
  aiCommands: Array<{ command: string; purpose: string }>
  operationModes: AIOperationModeDefinition[]
  transport: AITransportContract
  rules?: {
    path: string
    content: string
  }
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
  { path: "docs/PUBLIC_SURFACE_MAP.md", purpose: "Каноническая import map и bounded public surfaces" },
  { path: "docs/PRODUCT_SURFACE_AUDIT.md", purpose: "Краткий индекс закрытых и частично зрелых product surfaces" },
  { path: "docs/CLI_CONTRACT.json", purpose: "Machine-readable CLI command matrix и AI subcommand surface" },
  { path: "docs/AI_INTEGRATION_CONTRACT.json", purpose: "Machine-readable local editor/tool integration contract for AI artifacts" },
  { path: "docs/SECURITY_MODEL.md", purpose: "Runtime/security guarantees и fail-closed модель" },
  { path: "docs/AI_WORKFLOWS.md", purpose: "Канонический human+agent workflow" },
  { path: "docs/AI_SURFACE_STABILITY.md", purpose: "Стабильность AI-facing surface" },
  { path: "docs/AI_ARTIFACT_CONTRACT.md", purpose: "Versioned AI artifacts, checkpoints, and handoff expectations" },
  { path: "docs/AI_SESSION_PACKS.md", purpose: "Cross-session handoff для агентов" },
  { path: "docs/REACTIVE_RUNTIME.md", purpose: "Реактивная модель, diagnostics, resources, mutations, islands" },
  { path: "docs/REACTIVE_MEASUREMENT_CONTRACT.json", purpose: "Machine-readable reactive benchmark backlog and remaining evidence gaps" },
  { path: "docs/COMPETITION_CLOSURE_PLAN.md", purpose: "Операторский план закрытия remaining external competition gaps" },
  { path: "docs/COMPETITION_BACKLOG.json", purpose: "Machine-readable backlog для remaining external competition work" },
  { path: "docs/EXTERNAL_PROOF_INTAKE.md", purpose: "Канонический intake workflow для внешних migration/reference кейсов" },
  { path: "docs/EXTERNAL_PROOF_PIPELINE.json", purpose: "Pending queue for external proof candidates before acceptance" },
  { path: "docs/EXTERNAL_PROOF_REVIEW.md", purpose: "Review workflow для перевода external proof из pending в accepted" },
  { path: "docs/EXTERNAL_PROOF_REGISTRY.json", purpose: "Accepted registry for public external proof entries" },
  { path: "docs/SUPPORT_MATRIX.md", purpose: "Поддерживаемые runtime targets, CLI surfaces, and CI-validated contract" },
  { path: "docs/DEPLOY_TARGET_GUIDE.md", purpose: "Mode-aware deploy target guidance и runtime profiles" },
  { path: "docs/STARTER_ONBOARDING.md", purpose: "Стартовые app-классы и onboarding path" },
  { path: "docs/MIGRATION_GUIDE.md", purpose: "Переход с compatibility imports на canonical surfaces" },
  { path: "docs/RUNTIME_TRIAGE.md", purpose: "Триаж runtime/regression проблем" },
  { path: "docs/STARTER_FAILURES.md", purpose: "Частые ошибки установки и scaffold" },
]

const AI_COMMANDS: Array<{ command: string; purpose: string }> = [
  { command: "gorsee ai init", purpose: "Bootstrap local AI rules, operator guide, and checkpoint directory" },
  { command: "gorsee ai framework --format markdown", purpose: "Канонический cold-start packet по фреймворку" },
  { command: "gorsee ai tail --limit 20", purpose: "Просмотр последних structured AI events" },
  { command: "gorsee ai replay", purpose: "Восстановление коррелированного AI/runtime event timeline" },
  { command: "gorsee ai doctor", purpose: "Сводка diagnostics/incidents/artifact regressions" },
  { command: "gorsee ai export --format markdown", purpose: "Компактный packet по текущему AI/runtime состоянию" },
  { command: "gorsee ai export --bundle --format markdown", purpose: "Runtime packet с ранжированными code snippets" },
  { command: "gorsee ai pack", purpose: "Запись session pack в .gorsee/agent" },
  { command: "gorsee ai checkpoint --mode inspect", purpose: "Явный checkpoint текущего AI session state с metadata по режиму" },
  { command: "gorsee ai ide-sync", purpose: "IDE-friendly projection файлов" },
  { command: "gorsee ai bridge", purpose: "Локальный ingest bridge для trusted IDE/agent tooling" },
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

function normalizeCLICommands(
  value: unknown,
): Array<{ command: string; stability: string; purpose: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const command = typeof entry.command === "string" ? entry.command : undefined
    const stability = typeof entry.stability === "string" ? entry.stability : undefined
    const purpose = typeof entry.purpose === "string" ? entry.purpose : undefined
    if (!command || !stability || !purpose) return []
    return [{ command, stability, purpose }]
  })
}

async function resolveProjectName(cwd: string): Promise<string> {
  const pkg = await readJSON(join(cwd, "package.json"))
  if (typeof pkg?.name === "string" && pkg.name.trim().length > 0) return pkg.name
  return basename(cwd)
}

async function resolveCLIContract(): Promise<{
  topLevelCommands: Array<{ command: string; stability: string; purpose: string }>
  aiSubcommands: Array<{ command: string; stability: string; purpose: string }>
}> {
  const contract = await readJSON(join(import.meta.dir, "..", "..", "docs", "CLI_CONTRACT.json"))
  return {
    topLevelCommands: normalizeCLICommands(contract?.topLevelCommands),
    aiSubcommands: normalizeCLICommands(contract?.aiSubcommands),
  }
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
  const rules = await resolveAIRulesFile(cwd)
  const cliContract = await resolveCLIContract()

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
      scoped: [
        "gorsee/auth",
        "gorsee/db",
        "gorsee/security",
        "gorsee/ai",
        "gorsee/forms",
        "gorsee/routes",
        "gorsee/i18n",
        "gorsee/content",
        "gorsee/env",
        "gorsee/log",
        "gorsee/testing",
      ],
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
    cli: cliContract,
    aiCommands: AI_COMMANDS,
    operationModes: AI_OPERATION_MODES,
    transport: AI_TRANSPORT_CONTRACT,
    rules: rules
      ? {
          path: rules.path,
          content: rules.content,
        }
      : undefined,
    docs: {
      local: localDocs,
      canonical: canonicalDocs,
    },
    recommendedStart: [
      "Read AGENTS.md first when it exists.",
      "Read FRAMEWORK.md for the current app shape and syntax.",
      "Read docs/PUBLIC_SURFACE_MAP.md for the canonical import map and scoped stable surfaces.",
      "Read docs/PRODUCT_SURFACE_AUDIT.md for the current closed-vs-partial maturity snapshot before making broad product claims.",
      "Read docs/AI_INTEGRATION_CONTRACT.json when editor tooling, MCP, bridge, or session-handoff integration boundaries matter.",
      "Read docs/SUPPORT_MATRIX.md when runtime, packaging, or deploy assumptions matter.",
      "Read docs/REACTIVE_MEASUREMENT_CONTRACT.json before making broad benchmark or reactivity evidence claims.",
      "Read docs/COMPETITION_CLOSURE_PLAN.md and docs/COMPETITION_BACKLOG.json before making market-competition or adoption claims.",
      "Use the external-proof intake/review/registry docs for real public migration stories and external references; do not treat pending entries as accepted proof.",
      "Prefer inspect/propose modes before apply/operate when the task is still ambiguous.",
      `Respect the current app.mode contract: ${appMode}.`,
      "Use gorsee/client for browser-safe code and gorsee/server for runtime/server boundaries.",
      "Prefer scoped stable subpaths when auth, db, security, forms, routes, ai, i18n, content, env, log, or testing is the primary concern.",
      "Keep model traffic provider-direct or self-hosted; treat the AI bridge as diagnostics transport, not as the production request path.",
      "Use gorsee ai init when local AI workflows are enabled but the repository has no explicit local rules scaffold yet.",
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
    "## CLI Commands",
    "",
    ...packet.cli.topLevelCommands.map((entry) => `- \`${entry.command}\` [${entry.stability}] -- ${entry.purpose}`),
    "",
    "## CLI AI Subcommands",
    "",
    ...packet.cli.aiSubcommands.map((entry) => `- \`${entry.command}\` [${entry.stability}] -- ${entry.purpose}`),
    "",
    "## AI Operation Modes",
    "",
    ...packet.operationModes.map((entry) => `- \`${entry.mode}\` -- ${entry.purpose}`),
    "",
    "## AI Transport Contract",
    "",
    `- Model traffic: ${packet.transport.modelTraffic}`,
    `- Bridge role: ${packet.transport.bridgeRole}`,
    `- Production role: ${packet.transport.productionRole}`,
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
    ...(packet.rules
      ? [
          "## AI Rules",
          "",
          `Source: \`${packet.rules.path}\``,
          "",
          packet.rules.content,
          "",
        ]
      : []),
    packet.frameworkReferenceMarkdown,
  ]

  return lines.filter((line) => line !== undefined).join("\n")
}
