import { access, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { AppMode } from "../runtime/app-config.ts"

export type AIOperationMode = "inspect" | "propose" | "apply" | "operate"

export interface AIOperationModeDefinition {
  mode: AIOperationMode
  purpose: string
  mutatesFiles: boolean
  mutatesRuntime: boolean
}

export interface AIRulesFile {
  path: string
  content: string
}

export interface AITransportContract {
  modelTraffic: "provider-direct-or-self-hosted"
  bridgeRole: "diagnostics-and-ingestion-only"
  productionRole: "must-not-sit-on-the-runtime-request-path"
}

export const AI_OPERATION_MODES: AIOperationModeDefinition[] = [
  {
    mode: "inspect",
    purpose: "Read code, diagnostics, and contracts without mutating files or runtime state.",
    mutatesFiles: false,
    mutatesRuntime: false,
  },
  {
    mode: "propose",
    purpose: "Prepare change plans, patches, or remediation guidance without applying them.",
    mutatesFiles: false,
    mutatesRuntime: false,
  },
  {
    mode: "apply",
    purpose: "Write code or config changes in the repository without operating long-running runtime surfaces.",
    mutatesFiles: true,
    mutatesRuntime: false,
  },
  {
    mode: "operate",
    purpose: "Perform runtime-facing actions such as deploy, worker, bridge, or incident operations with explicit operator intent.",
    mutatesFiles: true,
    mutatesRuntime: true,
  },
]

export const AI_TRANSPORT_CONTRACT: AITransportContract = {
  modelTraffic: "provider-direct-or-self-hosted",
  bridgeRole: "diagnostics-and-ingestion-only",
  productionRole: "must-not-sit-on-the-runtime-request-path",
}

export function renderDefaultAIRulesMarkdown(input: {
  projectName: string
  appMode: AppMode
}): string {
  return [
    "# AI Rules",
    "",
    `Project: ${input.projectName}`,
    `App Mode: ${input.appMode}`,
    "",
    "## Defaults",
    "",
    "- Start in `inspect` mode unless the task clearly requires mutation.",
    "- Prefer `propose` before `apply` when requirements are still ambiguous.",
    "- Use `operate` only for deploy, worker, bridge, incident, or other runtime-facing actions.",
    "- Before `apply` or `operate`, write an explicit checkpoint with `gorsee ai checkpoint --mode <mode>`.",
    "- Treat `gorsee/client` and `gorsee/server` boundaries as framework contracts, not convenience suggestions.",
    "- Prefer scoped stable subpaths (`gorsee/auth`, `gorsee/forms`, `gorsee/routes`, etc.) when the concern is already domain-specific.",
    "",
    "## Safety",
    "",
    "- Keep model traffic provider-direct or self-hosted when integrating external models.",
    "- Do not place AI bridge transport on the production request path.",
    "- Prefer structured artifacts in `.gorsee/` over scraped logs.",
    "- Run `gorsee check` after mutating AI workflows.",
    "",
    "## Local Notes",
    "",
    "- Record project-specific constraints here instead of repeating them in every prompt.",
    "- Add product, security, deploy, or incident rules here when this repo develops stronger local requirements.",
    "",
  ].join("\n")
}

export function renderDefaultAIGuideMarkdown(input: {
  projectName: string
  appMode: AppMode
}): string {
  return [
    "# Gorsee AI Local Guide",
    "",
    `Project: ${input.projectName}`,
    `App Mode: ${input.appMode}`,
    "",
    "This file is the local operator-facing AI guide for the repository.",
    "",
    "## Canonical Files",
    "",
    "- `.gorsee/rules.md` is the canonical local rules file consumed by Gorsee AI workflows.",
    "- `AGENTS.md` remains the primary repository contract when present.",
    "- `FRAMEWORK.md` remains the app/framework reference when present.",
    "",
    "## Recommended Workflow",
    "",
    "1. Run `gorsee ai framework --format markdown` for cold-start context.",
    "2. Keep the session in `inspect` or `propose` until mutation is justified.",
    "3. Before `apply` or `operate`, run `gorsee ai checkpoint --mode <mode>`.",
    "4. Use `gorsee ai pack` for handoff and `gorsee ai doctor` for diagnostics-first triage.",
    "5. Run `gorsee check` after mutating work.",
    "",
    "## Local Customization",
    "",
    "- Extend `.gorsee/rules.md` with repo-specific constraints.",
    "- Add team-specific AI operating notes here only when they are broader than per-task instructions.",
    "",
  ].join("\n")
}

const RULES_CANDIDATES = [
  ".gorsee/rules.md",
  "GORSEE.md",
]

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function resolveAIRulesFile(cwd: string): Promise<AIRulesFile | undefined> {
  for (const candidate of RULES_CANDIDATES) {
    const absolutePath = join(cwd, candidate)
    if (!(await pathExists(absolutePath))) continue
    return {
      path: candidate,
      content: await readFile(absolutePath, "utf-8"),
    }
  }

  return undefined
}
