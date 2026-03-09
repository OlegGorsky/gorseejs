import { relative } from "node:path"
import { analyzeModuleSource, type ModuleImportFact } from "../compiler/module-analysis.ts"

export interface ASTCheckIssue {
  code: string
  file: string
  line?: number
  message: string
  fix?: string
}

export interface ASTFileFacts {
  issues: ASTCheckIssue[]
  hasServerCall: boolean
  hasRouteCacheCall: boolean
  hasCreateAuthCall: boolean
  hasRedirectCall: boolean
  hasCtxRedirectCall: boolean
  hasLegacyLoaderExport: boolean
  importsRootGorsee: boolean
  imports: ModuleImportFact[]
}

type TSModule = typeof import("typescript")

let tsModulePromise: Promise<TSModule | null> | null = null

async function loadTypeScript(): Promise<TSModule | null> {
  if (!tsModulePromise) {
    tsModulePromise = import("typescript").catch(() => null)
  }
  return tsModulePromise
}

function pushIssue(
  issues: ASTCheckIssue[],
  seen: Set<string>,
  issue: ASTCheckIssue,
): void {
  const key = `${issue.code}:${issue.file}:${issue.line ?? 0}:${issue.message}`
  if (seen.has(key)) return
  seen.add(key)
  issues.push(issue)
}

function isIdentifier(ts: TSModule, node: unknown, name: string): boolean {
  return ts.isIdentifier(node as import("typescript").Node) && (node as import("typescript").Identifier).text === name
}

function getLine(ts: TSModule, sourceFile: import("typescript").SourceFile, node: import("typescript").Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function isLiteralRedirectTarget(ts: TSModule, node: import("typescript").Expression | undefined): boolean {
  if (!node) return false
  if (ts.isStringLiteralLike(node)) return true
  if (ts.isNoSubstitutionTemplateLiteral(node)) return true
  return false
}

function isDbCall(ts: TSModule, expr: import("typescript").CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(expr.expression)) return false
  const target = expr.expression.expression
  const method = expr.expression.name.text
  return isIdentifier(ts, target, "db") && ["get", "all", "run"].includes(method)
}

function hasRouteCacheIntent(ts: TSModule, expr: import("typescript").CallExpression): boolean {
  const firstArg = expr.arguments[0]
  if (!firstArg || !ts.isObjectLiteralExpression(firstArg)) return false
  return firstArg.properties.some((prop) => {
    if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) return false
    const name = prop.name?.getText(firstArg.getSourceFile()).replace(/['"]/g, "")
    return name === "includeAuthHeaders" || name === "vary" || name === "key" || name === "mode"
  })
}

export async function analyzeFileWithAST(
  file: string,
  cwd: string,
  content: string,
): Promise<ASTFileFacts | null> {
  const ts = await loadTypeScript()
  if (!ts) return null

  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const moduleFacts = analyzeModuleSource(file, content)
  const rel = relative(cwd, file)
  const issues: ASTCheckIssue[] = []
  const seen = new Set<string>()
  const facts: ASTFileFacts = {
    issues,
    hasServerCall: false,
    hasRouteCacheCall: false,
    hasCreateAuthCall: false,
    hasRedirectCall: false,
    hasCtxRedirectCall: false,
    hasLegacyLoaderExport: moduleFacts.exportedNames.has("loader"),
    importsRootGorsee: moduleFacts.imports.some((entry) => entry.specifier === "gorsee"),
    imports: moduleFacts.imports,
  }

  const visit = (node: import("typescript").Node): void => {
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && node.left.name.text === "innerHTML"
    ) {
      pushIssue(issues, seen, {
        code: "E002",
        file: rel,
        line: getLine(ts, sourceFile, node),
        message: "Direct innerHTML assignment (XSS risk)",
        fix: "Use SafeHTML`...`, sanitize(), or DOM fragment replacement helpers",
      })
    }

    if (ts.isCallExpression(node)) {
      if (isIdentifier(ts, node.expression, "server")) {
        facts.hasServerCall = true
      }

      if (isIdentifier(ts, node.expression, "createAuth")) {
        facts.hasCreateAuthCall = true
      }

      if (isIdentifier(ts, node.expression, "routeCache")) {
        facts.hasRouteCacheCall = true
        if (!hasRouteCacheIntent(ts, node)) {
          pushIssue(issues, seen, {
            code: "W904",
            file: rel,
            line: getLine(ts, sourceFile, node),
            message: "routeCache() is used without explicit public/private cache intent",
            fix: "Set includeAuthHeaders, vary, key, or mode explicitly to document cache boundary",
          })
        }
      }

      if (isIdentifier(ts, node.expression, "redirect")) {
        facts.hasRedirectCall = true
        if (!isLiteralRedirectTarget(ts, node.arguments[0])) {
          pushIssue(issues, seen, {
            code: "W905",
            file: rel,
            line: getLine(ts, sourceFile, node),
            message: "Throwable redirect() uses a non-literal target",
            fix: "Prefer ctx.redirect() for user-controlled values or sanitize redirect targets explicitly before throwing redirect()",
          })
        }
      }

      if (
        ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === "ctx"
        && node.expression.name.text === "redirect"
      ) {
        facts.hasCtxRedirectCall = true
      }

      if (isDbCall(ts, node)) {
        const firstArg = node.arguments[0]
        if (firstArg) {
          if (ts.isNoSubstitutionTemplateLiteral(firstArg) || ts.isTemplateExpression(firstArg)) {
            pushIssue(issues, seen, {
              code: "E001",
              file: rel,
              line: getLine(ts, sourceFile, node),
              message: "Raw template literal in database query (SQL injection risk)",
              fix: "Use SafeSQL`...` tagged template: db.get(SafeSQL`SELECT ...`)",
            })
          } else if (
            ts.isStringLiteral(firstArg)
            || ts.isBinaryExpression(firstArg)
          ) {
            pushIssue(issues, seen, {
              code: "E001",
              file: rel,
              line: getLine(ts, sourceFile, node),
              message: "String concatenation in database query (SQL injection risk)",
              fix: "Use SafeSQL`...` tagged template with parameterized values",
            })
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return facts
}
