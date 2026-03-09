// gorsee check -- validate project structure, types, and safety

import { isAbsolute, join, relative, resolve } from "node:path"
import { readdir, stat, readFile } from "node:fs/promises"
import { createRouter } from "../router/scanner.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"
import { analyzeFileWithAST, type ASTFileFacts } from "./check-ast.ts"
import { initializeCompilerBackends } from "../compiler/init.ts"
import { collectCanonicalImportDrift } from "./canonical-imports.ts"
import { rewriteCanonicalImportsInProject, rewriteLegacyLoadersInProject } from "./canonical-import-rewrite.ts"
import {
  configureAIObservability,
  emitAIDiagnostic,
  emitAIEvent,
  type AIObservabilityConfig,
} from "../ai/index.ts"
import { loadAppConfig, resolveAIConfig } from "../runtime/app-config.ts"

interface CheckResult {
  errors: CheckIssue[]
  warnings: CheckIssue[]
  info: string[]
}

interface CheckIssue {
  code: string
  file: string
  line?: number
  message: string
  fix?: string
}

const MAX_FILE_LINES = 500
export type { CheckResult, CheckIssue }

async function getAllTsFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return files
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue
    const fullPath = join(dir, entry)
    const s = await stat(fullPath)
    if (s.isDirectory()) {
      files.push(...(await getAllTsFiles(fullPath)))
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(fullPath)
    }
  }
  return files
}

async function checkFileSize(file: string, cwd: string): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []
  const content = await readFile(file, "utf-8")
  const lines = content.split("\n").length
  const rel = relative(cwd, file)

  if (lines > MAX_FILE_LINES) {
    issues.push({
      code: "E901",
      file: rel,
      message: `File has ${lines} lines (limit: ${MAX_FILE_LINES}). Must split before merge.`,
      fix: "Extract logic into focused modules by responsibility",
    })
  } else if (lines > 300) {
    issues.push({
      code: "W901",
      file: rel,
      message: `File has ${lines} lines (warning threshold: 300). Plan to split.`,
      fix: "Consider extracting into separate modules",
    })
  }

  return issues
}

async function checkUnsafePatterns(file: string, cwd: string): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []
  const content = await readFile(file, "utf-8")
  const astFacts = await analyzeFileWithAST(file, cwd, content)
  if (astFacts) {
    issues.push(...astFacts.issues)
    return issues
  }
  const lines = content.split("\n")
  const rel = relative(cwd, file)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNum = i + 1

    // Check for string concatenation in SQL-like contexts
    if (line.match(/db\.(get|all|run)\s*\(\s*`/) && !line.includes("SafeSQL")) {
      issues.push({
        code: "E001",
        file: rel,
        line: lineNum,
        message: "Raw template literal in database query (SQL injection risk)",
        fix: "Use SafeSQL`...` tagged template: db.get(SafeSQL`SELECT ...`)",
      })
    }

    // Check for string concat in db calls
    if (line.match(/db\.(get|all|run)\s*\(\s*["']/) || line.match(/db\.(get|all|run)\s*\([^S]*\+/)) {
      issues.push({
        code: "E001",
        file: rel,
        line: lineNum,
        message: "String concatenation in database query (SQL injection risk)",
        fix: "Use SafeSQL`...` tagged template with parameterized values",
      })
    }

    // Check for innerHTML usage
    if (line.includes(".innerHTML") && !line.includes("unsafeHTML")) {
      issues.push({
        code: "E002",
        file: rel,
        line: lineNum,
        message: "Direct innerHTML assignment (XSS risk)",
        fix: "Use SafeHTML`...` or sanitize() from gorsee/types",
      })
    }

    if (!line.includes("ctx.redirect(")) {
      const redirectCall = line.match(/\bredirect\s*\(\s*([^,\)]+)/)
      if (redirectCall) {
        const targetExpr = redirectCall[1]!.trim()
        const isStaticLiteral = targetExpr.startsWith('"')
          || targetExpr.startsWith("'")
          || targetExpr.startsWith("`")
          || targetExpr.startsWith("/")

        if (!isStaticLiteral) {
          issues.push({
            code: "W905",
            file: rel,
            line: lineNum,
            message: "Throwable redirect() uses a non-literal target",
            fix: "Prefer ctx.redirect() for user-controlled values or sanitize redirect targets explicitly before throwing redirect()",
          })
        }
      }
    }
  }

  return issues
}

async function collectASTFacts(files: string[], cwd: string): Promise<Map<string, ASTFileFacts>> {
  const facts = new Map<string, ASTFileFacts>()
  for (const file of files) {
    const content = await readFile(file, "utf-8")
    const ast = await analyzeFileWithAST(file, cwd, content)
    if (ast) facts.set(file, ast)
  }
  return facts
}

async function checkProjectStructure(cwd: string): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []

  // Check routes/ exists
  try {
    await stat(join(cwd, "routes"))
  } catch {
    issues.push({
      code: "E902",
      file: ".",
      message: "Missing routes/ directory",
      fix: "Create routes/ directory with at least routes/index.ts",
    })
  }

  // Check app.config.ts exists
  try {
    await stat(join(cwd, "app.config.ts"))
  } catch {
    issues.push({
      code: "W902",
      file: ".",
      message: "Missing app.config.ts",
      fix: "Create app.config.ts with project configuration",
    })
  }

  return issues
}

async function checkSecurityContracts(
  cwd: string,
  files: string[],
  astFacts: Map<string, ASTFileFacts>,
): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []
  const appConfigPath = join(cwd, "app.config.ts")
  const appConfigSource = await tryReadFile(appConfigPath)

  const hasServerCalls = await projectUsesServerFunctions(files, astFacts)
  const hasRouteCacheUsage = await projectUsesRouteCache(files, astFacts)
  const needsTrustedOrigin = await projectNeedsTrustedOrigin(files, astFacts)
  const hasRPCMiddlewares = appConfigDeclaresRPCMiddlewares(appConfigSource)
  const hasTrustedOrigin = appConfigDeclaresTrustedOrigin(appConfigSource)

  if (hasServerCalls && !hasRPCMiddlewares) {
    issues.push({
      code: "W903",
      file: "app.config.ts",
      message: "Project uses server() calls but app.config.ts does not declare security.rpc.middlewares",
      fix: "Add security.rpc.middlewares or pass rpcMiddlewares programmatically in dev/prod startup",
    })
  }

  if (hasRouteCacheUsage) {
    for (const file of files) {
      if (astFacts.has(file)) continue
      const content = await readFile(file, "utf-8")
      const rel = relative(cwd, file)
      const lines = content.split("\n")

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (!line.includes("routeCache(")) continue

        const block = lines.slice(i, Math.min(i + 8, lines.length)).join("\n")
        const hasExplicitCacheIntent = /includeAuthHeaders\s*:|key\s*:|vary\s*:/.test(block)
        if (!hasExplicitCacheIntent) {
          issues.push({
            code: "W904",
            file: rel,
            line: i + 1,
            message: "routeCache() is used without explicit public/private cache intent",
            fix: "Set includeAuthHeaders, vary, or key explicitly to document cache boundary",
          })
        }
      }
    }
  }

  if (needsTrustedOrigin && !hasTrustedOrigin) {
    issues.push({
      code: "W906",
      file: "app.config.ts",
      message: "Project uses origin-sensitive server features but app.config.ts does not declare security.origin",
      fix: "Add security.origin (or APP_ORIGIN for runtime fallback) so redirects and origin checks use a canonical application origin",
    })
  }

  return issues
}

function checkImportContracts(cwd: string, astFacts: Map<string, ASTFileFacts>): CheckIssue[] {
  const issues: CheckIssue[] = []

  for (const [file, facts] of astFacts) {
    const rel = relative(cwd, file)

    if (facts.importsRootGorsee) {
      issues.push({
        code: "W911",
        file: rel,
        message: 'Importing from root "gorsee" weakens canonical client/server boundaries',
        fix: 'Import browser-safe APIs from "gorsee/client", server APIs from "gorsee/server", and use "gorsee/compat" only for explicit compatibility bridges',
      })
    }

    if (facts.hasLegacyLoaderExport) {
      issues.push({
        code: "W916",
        file: rel,
        message: 'Route module still exports "loader" instead of canonical "load"',
        fix: 'Rename exported "loader" to "load", or run `gorsee check --rewrite-loaders` / `gorsee upgrade --rewrite-imports` to rewrite obvious cases automatically',
      })
    }

    for (const drift of collectCanonicalImportDrift(facts.imports)) {
      const entries = [...drift.replacements.entries()].map(([name, target]) => `${name} -> ${target}`).join(", ")
      const targets = [...new Set(drift.replacements.values())].join(", ")
      issues.push({
        code: drift.source === "gorsee/server" ? "W914" : "W915",
        file: rel,
        message: `Domain APIs imported from "${drift.source}" should use scoped stable subpaths: ${entries}`,
        fix: drift.source === "gorsee/server"
          ? `Keep runtime primitives on "gorsee/server" and move domain imports to scoped entrypoints such as ${targets}`
          : `Keep browser runtime primitives on "gorsee/client" and move domain imports to scoped entrypoints such as ${targets}`,
      })
    }
  }

  return issues
}

async function checkDependencyPolicy(cwd: string): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []
  const packageJsonPath = join(cwd, "package.json")
  const packageJsonSource = await tryReadFile(packageJsonPath)
  if (!packageJsonSource) return issues

  try {
    const pkg = JSON.parse(packageJsonSource) as {
      packageManager?: string
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }
    const workspaceContext = await findWorkspaceDependencyContext(cwd)
    const effectivePackageManager = pkg.packageManager ?? workspaceContext?.packageManager ?? null
    const lockfileSource = workspaceContext?.lockfileSource ?? await tryReadFile(join(cwd, "bun.lock"))
    const lockfileLabel = workspaceContext?.lockfileLabel ?? "bun.lock"

    if (!effectivePackageManager || !/^bun@\d+\.\d+\.\d+$/.test(effectivePackageManager)) {
      issues.push({
        code: "W910",
        file: "package.json",
        message: "package.json should declare an exact Bun packageManager version",
        fix: 'Set packageManager to an exact Bun version such as "bun@1.3.9" (on the app package or workspace root)',
      })
    }
    for (const field of ["dependencies", "optionalDependencies"] as const) {
      for (const [name, version] of Object.entries(pkg[field] ?? {})) {
        if (/^[\^~><=*]/.test(version)) {
          issues.push({
            code: "W907",
            file: "package.json",
            message: `Runtime dependency ${name} uses non-pinned version ${version}`,
            fix: "Pin runtime dependency versions exactly to reduce supply-chain drift in production builds",
          })
        }
      }
    }

    if (!lockfileSource) {
      issues.push({
        code: "W909",
        file: lockfileLabel,
        message: "Missing bun.lock for a Bun project",
        fix: "Commit bun.lock so runtime dependency resolution is reproducible",
      })
      return issues
    }

    const runtimeDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.optionalDependencies ?? {}),
    }
    for (const [name, version] of Object.entries(runtimeDeps)) {
      if (version.startsWith("workspace:")) continue
      const resolved = readLockedPackageVersion(lockfileSource, name)
      if (!resolved) {
        issues.push({
          code: "W909",
          file: lockfileLabel,
          message: `bun.lock does not contain resolved package metadata for ${name}`,
          fix: "Regenerate and commit bun.lock after updating runtime dependencies",
        })
        continue
      }
      if (normalizeDependencyVersion(cwd, resolved) !== normalizeDependencyVersion(cwd, version)) {
        issues.push({
          code: "W909",
          file: lockfileLabel,
          message: `bun.lock resolves ${name}@${resolved} but package.json pins ${version}`,
          fix: "Regenerate bun.lock or align package.json with the locked runtime dependency version",
        })
      }
    }
  } catch {
    issues.push({
      code: "W907",
      file: "package.json",
      message: "Could not parse package.json for dependency policy checks",
      fix: "Ensure package.json is valid JSON",
    })
  }

  return issues
}

async function findWorkspaceDependencyContext(cwd: string): Promise<{
  packageManager: string | null
  lockfileSource: string | null
  lockfileLabel: string
} | null> {
  let current = resolve(cwd)
  while (true) {
    const parent = resolve(current, "..")
    if (parent === current) return null

    const packageJsonSource = await tryReadFile(join(parent, "package.json"))
    if (packageJsonSource) {
      try {
        const pkg = JSON.parse(packageJsonSource) as {
          packageManager?: string
          workspaces?: unknown
        }
        const isWorkspaceRoot = Array.isArray(pkg.workspaces)
          || typeof pkg.workspaces === "object"
          || pkg.workspaces === true
        if (isWorkspaceRoot) {
          const lockfileSource = await tryReadFile(join(parent, "bun.lock"))
          return {
            packageManager: pkg.packageManager ?? null,
            lockfileSource,
            lockfileLabel: relative(cwd, join(parent, "bun.lock")) || "bun.lock",
          }
        }
      } catch {
        // Ignore invalid parent package manifests here; the app package handles its own parse errors.
      }
    }

    current = parent
  }
}

async function checkTypeScriptContract(cwd: string): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []
  const source = await tryReadFile(join(cwd, "tsconfig.json"))
  if (!source) return issues

  try {
    const tsconfig = JSON.parse(source) as {
      compilerOptions?: {
        jsx?: string
        jsxImportSource?: string
      }
    }

    if (tsconfig.compilerOptions?.jsx !== "preserve") {
      issues.push({
        code: "W912",
        file: "tsconfig.json",
        message: 'Canonical Gorsee TSX contract expects compilerOptions.jsx to be "preserve"',
        fix: 'Set compilerOptions.jsx to "preserve" so the compiler/runtime pipeline stays aligned with Gorsee JSX semantics',
      })
    }

    if (tsconfig.compilerOptions?.jsxImportSource !== "gorsee") {
      issues.push({
        code: "W913",
        file: "tsconfig.json",
        message: 'Canonical Gorsee TSX contract expects compilerOptions.jsxImportSource to be "gorsee"',
        fix: 'Set compilerOptions.jsxImportSource to "gorsee" so generated and handwritten route modules resolve the same JSX runtime contract',
      })
    }
  } catch {
    issues.push({
      code: "W914",
      file: "tsconfig.json",
      message: "Could not parse tsconfig.json for canonical TypeScript contract checks",
      fix: "Ensure tsconfig.json is valid JSON",
    })
  }

  return issues
}

async function checkOriginPlaceholderPolicy(cwd: string): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []
  const filesToScan = [
    "app.config.ts",
    "wrangler.toml",
    "netlify.toml",
    "fly.toml",
    "vercel.json",
  ]
  const placeholderPatterns = [
    /REPLACE_WITH_APP_ORIGIN/,
    /https:\/\/example\.com/,
  ]

  for (const file of filesToScan) {
    const source = await tryReadFile(join(cwd, file))
    if (!source) continue
    if (placeholderPatterns.some((pattern) => pattern.test(source))) {
      issues.push({
        code: "W908",
        file,
        message: `${file} still contains placeholder origin values`,
        fix: "Replace placeholder origins with the real canonical application origin before shipping",
      })
    }
  }

  return issues
}

async function projectUsesServerFunctions(files: string[], astFacts: Map<string, ASTFileFacts>): Promise<boolean> {
  for (const file of files) {
    const ast = astFacts.get(file)
    if (ast) {
      if (ast.hasServerCall) return true
      continue
    }
    const content = await readFile(file, "utf-8")
    if (/server\s*\(/.test(content)) return true
  }
  return false
}

async function projectUsesRouteCache(files: string[], astFacts: Map<string, ASTFileFacts>): Promise<boolean> {
  for (const file of files) {
    const ast = astFacts.get(file)
    if (ast) {
      if (ast.hasRouteCacheCall) return true
      continue
    }
    const content = await readFile(file, "utf-8")
    if (content.includes("routeCache(")) return true
  }
  return false
}

async function projectNeedsTrustedOrigin(files: string[], astFacts: Map<string, ASTFileFacts>): Promise<boolean> {
  for (const file of files) {
    const ast = astFacts.get(file)
    if (ast) {
      if (ast.hasCreateAuthCall || ast.hasRedirectCall || ast.hasCtxRedirectCall || ast.hasServerCall) {
        return true
      }
      continue
    }
    const content = await readFile(file, "utf-8")
    if (
      content.includes("createAuth(")
      || content.includes("redirect(")
      || content.includes("ctx.redirect(")
      || /server\s*\(/.test(content)
    ) {
      return true
    }
  }
  return false
}

function appConfigDeclaresRPCMiddlewares(source: string | null): boolean {
  if (!source) return false
  return /security\s*:\s*\{[\s\S]*rpc\s*:\s*\{[\s\S]*middlewares\s*:/m.test(source)
}

function appConfigDeclaresTrustedOrigin(source: string | null): boolean {
  if (!source) return false
  return /security\s*:\s*\{[\s\S]*origin\s*:/m.test(source)
}

function readLockedPackageVersion(lockfileSource: string, packageName: string): string | null {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = lockfileSource.match(new RegExp(`"${escaped}": \\["${escaped}@([^"]+)"`))
  return match?.[1] ?? null
}

function normalizeDependencyVersion(cwd: string, version: string): string {
  if (
    !version.startsWith("file:")
    && !version.endsWith(".tgz")
    && !version.startsWith(".")
    && !version.startsWith("/")
  ) {
    return version
  }
  const rawPath = version.startsWith("file:") ? version.slice(5) : version
  const absolutePath = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath)
  return `file:${absolutePath}`
}

async function tryReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8")
  } catch {
    return null
  }
}

export interface CheckCommandOptions extends RuntimeOptions {
  runTypeScript?: boolean
  strictSecurity?: boolean
  ai?: AIObservabilityConfig
  rewriteImports?: boolean
  rewriteLoaders?: boolean
}

export async function checkProject(options: CheckCommandOptions = {}): Promise<CheckResult> {
  const { cwd, paths } = createProjectContext(options)
  initializeCompilerBackends(options.env ?? process.env)
  const runTypeScript = options.runTypeScript ?? true
  const strictSecurity = options.strictSecurity ?? false
  const rewriteImports = options.rewriteImports ?? false
  const rewriteLoaders = options.rewriteLoaders ?? false
  const result: CheckResult = { errors: [], warnings: [], info: [] }
  const appConfig = await loadAppConfig(cwd)
  configureAIObservability(resolveAIConfig(cwd, appConfig, options.ai))

  await emitAIEvent({
    kind: "check.start",
    severity: "info",
    source: "check",
    message: "project check started",
    phase: "check",
    data: { cwd, runTypeScript, strictSecurity, rewriteImports, rewriteLoaders },
  })

  if (rewriteImports) {
    const rewrite = await rewriteCanonicalImportsInProject(cwd)
    result.info.push(
      rewrite.changedFiles.length > 0
        ? `Rewrote canonical imports in ${rewrite.changedFiles.length} file(s)`
        : "Canonical import rewrite found no changes",
    )
  }

  if (rewriteLoaders) {
    const rewrite = await rewriteLegacyLoadersInProject(cwd)
    result.info.push(
      rewrite.changedFiles.length > 0
        ? `Rewrote legacy loader exports in ${rewrite.changedFiles.length} file(s)`
        : "Legacy loader rewrite found no changes",
    )
  }

  const structIssues = await checkProjectStructure(cwd)
  for (const issue of structIssues) {
    if (issue.code.startsWith("E")) result.errors.push(issue)
    else result.warnings.push(issue)
  }

  try {
    const routes = await createRouter(paths.routesDir)
    result.info.push(`Found ${routes.length} route(s)`)
  } catch {
    result.info.push("Could not scan routes")
  }

  const files = await getAllTsFiles(paths.routesDir)
  files.push(...(await getAllTsFiles(paths.sharedDir)))
  files.push(...(await getAllTsFiles(paths.middlewareDir)))
  const astFacts = await collectASTFacts(files, cwd)

  for (const file of files) {
    const sizeIssues = await checkFileSize(file, cwd)
    const safetyIssues = await checkUnsafePatterns(file, cwd)
    for (const issue of [...sizeIssues, ...safetyIssues]) {
      pushIssue(result, issue, strictSecurity)
    }
  }

  const securityIssues = await checkSecurityContracts(cwd, files, astFacts)
  for (const issue of securityIssues) {
    pushIssue(result, issue, strictSecurity)
  }

  const importIssues = checkImportContracts(cwd, astFacts)
  for (const issue of importIssues) {
    pushIssue(result, issue, strictSecurity)
  }

  const dependencyIssues = await checkDependencyPolicy(cwd)
  for (const issue of dependencyIssues) {
    pushIssue(result, issue, strictSecurity)
  }

  const tsconfigIssues = await checkTypeScriptContract(cwd)
  for (const issue of tsconfigIssues) {
    pushIssue(result, issue, strictSecurity)
  }

  const placeholderIssues = await checkOriginPlaceholderPolicy(cwd)
  for (const issue of placeholderIssues) {
    pushIssue(result, issue, strictSecurity)
  }

  if (runTypeScript) {
    const tsc = Bun.spawn(["bun", "x", "tsc", "--noEmit"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    })
    const tscExit = await tsc.exited
    if (tscExit !== 0) {
      const stdout = await new Response(tsc.stdout).text()
      const stderr = await new Response(tsc.stderr).text()
      const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n")
      result.errors.push({
        code: "TSC",
        file: ".",
        message: `TypeScript errors:\n${details}`,
      })
    } else {
      result.info.push("TypeScript: no errors")
    }
  }

  for (const issue of result.warnings) {
    await emitAIDiagnostic({
      code: issue.code,
      message: issue.message,
      severity: "warn",
      source: "check",
      file: issue.file,
      line: issue.line,
      fix: issue.fix,
    })
  }
  for (const issue of result.errors) {
    await emitAIDiagnostic({
      code: issue.code,
      message: issue.message,
      severity: "error",
      source: "check",
      file: issue.file,
      line: issue.line,
      fix: issue.fix,
    })
  }
  await emitAIEvent({
    kind: "check.summary",
    severity: result.errors.length > 0 ? "error" : result.warnings.length > 0 ? "warn" : "info",
    source: "check",
    message: "project check completed",
    phase: "summary",
    data: {
      errors: result.errors.length,
      warnings: result.warnings.length,
      info: result.info.length,
      strictSecurity,
      runTypeScript,
      rewriteImports,
      rewriteLoaders,
    },
  })

  return result
}

/** @deprecated Use checkProject() for programmatic access. */
export async function runCheck(args: string[], options: CheckCommandOptions = {}) {
  const strictSecurity = options.strictSecurity ?? args.includes("--strict")
  const rewriteImports = options.rewriteImports ?? args.includes("--rewrite-imports")
  const rewriteLoaders = options.rewriteLoaders ?? args.includes("--rewrite-loaders")
  console.log("\n  Gorsee Check\n")
  if (options.runTypeScript ?? true) {
    console.log("  Running TypeScript check...")
  }
  if (strictSecurity) {
    console.log("  Security strict mode: enabled")
  }
  if (rewriteImports) {
    console.log("  Canonical import rewrite: enabled")
  }
  if (rewriteLoaders) {
    console.log("  Legacy loader rewrite: enabled")
  }
  const result = await checkProject({ ...options, strictSecurity, rewriteImports, rewriteLoaders })

  // Report
  for (const info of result.info) {
    console.log(`  [info] ${info}`)
  }
  for (const warn of result.warnings) {
    const loc = warn.line ? `${warn.file}:${warn.line}` : warn.file
    console.log(`  [warn] ${warn.code} ${loc}: ${warn.message}`)
    if (warn.fix) console.log(`         Fix: ${warn.fix}`)
  }
  for (const err of result.errors) {
    const loc = err.line ? `${err.file}:${err.line}` : err.file
    console.log(`  [ERROR] ${err.code} ${loc}: ${err.message}`)
    if (err.fix) console.log(`          Fix: ${err.fix}`)
  }

  console.log()
  if (result.errors.length === 0) {
    console.log(`  Result: PASS (${result.warnings.length} warning(s))`)
  } else {
    console.log(`  Result: FAIL (${result.errors.length} error(s), ${result.warnings.length} warning(s))`)
  }
  console.log()

  process.exit(result.errors.length > 0 ? 1 : 0)
}

function pushIssue(result: CheckResult, issue: CheckIssue, strictSecurity: boolean): void {
  const finalIssue = strictSecurity && issue.code.startsWith("W9")
    ? { ...issue, code: `E${issue.code.slice(1)}` }
    : issue

  if (finalIssue.code.startsWith("E")) result.errors.push(finalIssue)
  else result.warnings.push(finalIssue)
}
