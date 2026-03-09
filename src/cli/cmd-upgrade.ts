// gorsee upgrade -- upgrade framework version with migration guidance

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"
import { analyzeModuleSource } from "../compiler/module-analysis.ts"
import { collectCanonicalImportDrift } from "./canonical-imports.ts"
import { rewriteCanonicalImportsInProject, rewriteLegacyLoadersInProject } from "./canonical-import-rewrite.ts"

interface UpgradeFlags {
  check: boolean
  force: boolean
  report: string | null
  rewriteImports: boolean
}

export interface UpgradeIssue {
  code: string
  file: string
  severity: "info" | "warn"
  message: string
  fix: string
}

export interface UpgradeReport {
  schemaVersion: 1
  generatedAt: string
  currentVersion: string | null
  latestVersion: string | null
  upgradeAvailable: boolean
  issues: UpgradeIssue[]
}

export function parseUpgradeFlags(args: string[]): UpgradeFlags {
  const flags: UpgradeFlags = { check: false, force: false, report: null, rewriteImports: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--check") flags.check = true
    else if (arg === "--force") flags.force = true
    else if (arg === "--rewrite-imports") flags.rewriteImports = true
    else if (arg === "--report" && args[index + 1]) flags.report = args[++index]!
  }
  return flags
}

/** Compare semver strings: -1 (a < b), 0 (equal), 1 (a > b) */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number)
  const pb = b.replace(/^v/, "").split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}

async function getCurrentVersion(cwd: string): Promise<string | null> {
  try {
    const pkg = await readFile(join(cwd, "node_modules/gorsee/package.json"), "utf-8")
    return JSON.parse(pkg).version ?? null
  } catch {
    return null
  }
}

export const NPM_REGISTRY_URL = "https://registry.npmjs.org/gorsee/latest"

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(NPM_REGISTRY_URL)
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

async function tryReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8")
  } catch {
    return null
  }
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

function issue(
  code: string,
  file: string,
  message: string,
  fix: string,
  severity: "info" | "warn" = "warn",
): UpgradeIssue {
  return { code, file, severity, message, fix }
}

export async function collectUpgradeIssues(cwd: string): Promise<UpgradeIssue[]> {
  const issues: UpgradeIssue[] = []
  const tsconfigSource = await tryReadFile(join(cwd, "tsconfig.json"))
  if (tsconfigSource) {
    try {
      const tsconfig = JSON.parse(tsconfigSource) as {
        compilerOptions?: {
          jsx?: string
          jsxImportSource?: string
        }
      }
      if (tsconfig.compilerOptions?.jsx !== "preserve") {
        issues.push(issue(
          "UG001",
          "tsconfig.json",
          "Canonical Gorsee JSX mode is no longer configured",
          'Set compilerOptions.jsx to "preserve"',
        ))
      }
      if (tsconfig.compilerOptions?.jsxImportSource !== "gorsee") {
        issues.push(issue(
          "UG002",
          "tsconfig.json",
          "Canonical jsxImportSource is missing",
          'Set compilerOptions.jsxImportSource to "gorsee"',
        ))
      }
    } catch {
      issues.push(issue(
        "UG003",
        "tsconfig.json",
        "Could not parse tsconfig.json for migration checks",
        "Fix tsconfig.json so upgrade checks can validate the canonical compiler contract",
      ))
    }
  }

  const appConfigSource = await tryReadFile(join(cwd, "app.config.ts"))
  if (appConfigSource?.includes("ssr:")) {
    issues.push(issue(
      "UG004",
      "app.config.ts",
      "Deprecated app.config.ts key 'ssr' is still present",
      "Replace 'ssr' with the canonical 'rendering' configuration surface",
    ))
  }

  const packageJsonSource = await tryReadFile(join(cwd, "package.json"))
  if (packageJsonSource) {
    try {
      const pkg = JSON.parse(packageJsonSource) as { packageManager?: string }
      if (!pkg.packageManager || !/^bun@\d+\.\d+\.\d+$/.test(pkg.packageManager)) {
        issues.push(issue(
          "UG005",
          "package.json",
          "packageManager should pin the exact Bun version used by the project",
          'Set packageManager to an exact version such as "bun@1.3.9"',
        ))
      }
    } catch {
      issues.push(issue(
        "UG006",
        "package.json",
        "Could not parse package.json for upgrade checks",
        "Fix package.json so upgrade checks can validate package-manager and dependency contracts",
      ))
    }
  }

  for (const deployFile of ["app.config.ts", "wrangler.toml", "netlify.toml", "fly.toml", "vercel.json"]) {
    const source = await tryReadFile(join(cwd, deployFile))
    if (!source) continue
    if (/REPLACE_WITH_APP_ORIGIN|https:\/\/example\.com/.test(source)) {
      issues.push(issue(
        "UG007",
        deployFile,
        "Placeholder origin values are still present",
        "Replace placeholder origins with the canonical application origin before shipping the upgrade",
      ))
    }
  }

  const sourceFiles = [
    ...(await getAllSourceFiles(cwd, "routes")),
    ...(await getAllSourceFiles(cwd, "shared")),
    ...(await getAllSourceFiles(cwd, "middleware")),
  ]
  for (const file of sourceFiles) {
    const source = await tryReadFile(file)
    if (!source) continue
    const facts = analyzeModuleSource(file, source)
    if (facts.imports.some((entry) => entry.specifier === "gorsee")) {
      issues.push(issue(
        "UG008",
        relative(cwd, file),
        'Compatibility-only root "gorsee" import is still used in application code',
        'Move browser-safe imports to "gorsee/client", server code to "gorsee/server", or explicit compatibility bridges to "gorsee/compat"',
      ))
    }

    for (const drift of collectCanonicalImportDrift(facts.imports)) {
      const entries = [...drift.replacements.entries()].map(([name, target]) => `${name} -> ${target}`).join(", ")
      const targets = [...new Set(drift.replacements.values())].join(", ")
      issues.push(issue(
        drift.source === "gorsee/server" ? "UG009" : "UG010",
        relative(cwd, file),
        `Domain APIs still come from "${drift.source}" instead of scoped stable subpaths: ${entries}`,
        drift.source === "gorsee/server"
          ? `Keep runtime primitives on "gorsee/server" and move domain imports to ${targets}`
          : `Keep browser runtime primitives on "gorsee/client" and move domain imports to ${targets}`,
        "info",
      ))
    }

    if (facts.exportedNames.has("loader")) {
      issues.push(issue(
        "UG011",
        relative(cwd, file),
        'Route module still exports "loader" instead of canonical "load"',
        'Rename exported "loader" to "load", or run `gorsee upgrade --rewrite-imports` to rewrite obvious cases automatically',
        "info",
      ))
    }
  }

  return issues
}

export async function collectUpgradeReport(
  cwd: string,
  versions: { currentVersion: string | null; latestVersion: string | null },
): Promise<UpgradeReport> {
  const issues = await collectUpgradeIssues(cwd)
  const { currentVersion, latestVersion } = versions
  const upgradeAvailable = currentVersion !== null
    && latestVersion !== null
    && compareVersions(currentVersion, latestVersion) < 0

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    currentVersion,
    latestVersion,
    upgradeAvailable,
    issues,
  }
}

export async function writeUpgradeReport(cwd: string, reportPath: string, report: UpgradeReport): Promise<void> {
  const outputPath = join(cwd, reportPath)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf-8")
}

export interface UpgradeCommandOptions extends RuntimeOptions {}

export async function upgradeFramework(args: string[], options: UpgradeCommandOptions = {}) {
  const { cwd } = createProjectContext(options)
  const flags = parseUpgradeFlags(args)

  if (flags.rewriteImports) {
    const importRewrite = await rewriteCanonicalImportsInProject(cwd)
    const loaderRewrite = await rewriteLegacyLoadersInProject(cwd)
    const changedFiles = [...new Set([...importRewrite.changedFiles, ...loaderRewrite.changedFiles])].sort()
    if (changedFiles.length > 0) {
      console.log("\n  Rewrote canonical imports and loader aliases:")
      for (const file of changedFiles) {
        console.log(`    - ${file}`)
      }
    } else {
      console.log("\n  Canonical import and loader rewrite found no changes.")
    }
  }

  const current = await getCurrentVersion(cwd)
  if (!current) {
    console.log("\n  Gorsee.js not found in node_modules. Run: bun add gorsee\n")
    return
  }

  console.log(`\n  Current version: v${current}`)

  const latest = await fetchLatestVersion()
  if (!latest) {
    console.log("  Could not fetch latest version from npm registry.\n")
    return
  }

  const report = await collectUpgradeReport(cwd, {
    currentVersion: current,
    latestVersion: latest,
  })

  if (flags.report) {
    await writeUpgradeReport(cwd, flags.report, report)
    console.log(`  Upgrade report:  ${flags.report}`)
  }

  if (compareVersions(current, latest) >= 0) {
    console.log(`  Already up to date (v${current})`)
    if (report.issues.length > 0) {
      console.log("\n  Migration audit:")
      for (const entry of report.issues) {
        console.log(`    - [${entry.code}] ${entry.file}: ${entry.message}`)
      }
    }
    console.log()
    return
  }

  console.log(`  Latest version:  v${latest}`)
  console.log(`  Upgrade: v${current} -> v${latest}`)

  if (report.issues.length > 0) {
    console.log("\n  Migration audit:")
    for (const entry of report.issues) {
      console.log(`    - [${entry.code}] ${entry.file}: ${entry.message}`)
    }
  }

  if (flags.check) {
    console.log()
    return
  }

  if (!flags.force) {
    console.log("\n  Run with --force to install after reviewing the migration audit.\n")
    return
  }

  console.log("\n  Installing gorsee@latest...")
  const proc = Bun.spawn(["bun", "add", "gorsee@latest"], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  })
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    console.log(`\n  Install failed (exit code ${exitCode})\n`)
    process.exit(exitCode)
  }

  console.log(`\n  Upgraded successfully to v${latest}\n`)
}

/** @deprecated Use upgradeFramework() for programmatic access. */
export async function runUpgrade(args: string[], options: UpgradeCommandOptions = {}) {
  return upgradeFramework(args, options)
}
