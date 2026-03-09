import ts from "typescript"

const NON_LITERAL = Symbol("non-literal")

export interface ModuleImportFact {
  specifier: string
  names: string[]
  namespace?: string
  hasDefaultImport: boolean
}

export interface ModuleAnalysisFacts {
  exportedNames: Set<string>
  hasDefaultExport: boolean
  title: string
  meta: Record<string, unknown> | null
  exportedLiterals: Record<string, unknown>
  imports: ModuleImportFact[]
  sourceFile: unknown
}

export interface ModuleAnalysisBackend {
  name: string
  analyzeModuleSource(filePath: string, content: string): ModuleAnalysisFacts
}

export function createTypeScriptModuleAnalysisBackend(): ModuleAnalysisBackend {
  return {
    name: "typescript",
    analyzeModuleSource(filePath, content) {
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

      return {
        exportedNames: collectExportedNames(sourceFile),
        hasDefaultExport: hasDefaultExport(sourceFile),
        title: extractTitle(sourceFile, content),
        meta: extractMeta(sourceFile),
        exportedLiterals: collectExportedLiterals(sourceFile),
        imports: collectImports(sourceFile),
        sourceFile,
      }
    },
  }
}

function collectExportedNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement) && statement.name) {
      names.add(statement.name.text)
      continue
    }

    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
      }
    }
  }

  return names
}

function hasDefaultExport(sourceFile: ts.SourceFile): boolean {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) return true
    if (hasDefaultModifier(statement)) return true
  }
  return false
}

function collectImports(sourceFile: ts.SourceFile): ModuleImportFact[] {
  const imports: ModuleImportFact[] = []

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue

    const names: string[] = []
    let namespace: string | undefined
    let hasDefaultImport = false
    const clause = statement.importClause

    if (clause?.name) hasDefaultImport = true
    if (clause?.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        namespace = clause.namedBindings.name.text
      } else {
        for (const element of clause.namedBindings.elements) {
          names.push(element.name.text)
        }
      }
    }

    imports.push({
      specifier: statement.moduleSpecifier.text,
      names,
      namespace,
      hasDefaultImport,
    })
  }

  return imports
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false
  return ts.getModifiers(node)?.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function hasDefaultModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false
  return ts.getModifiers(node)?.some((modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false
}

function extractTitle(sourceFile: ts.SourceFile, content: string): string {
  for (const statement of sourceFile.statements) {
    const comment = getLeadingJSDocText(statement, content)
    if (comment) return comment
  }
  return ""
}

function getLeadingJSDocText(node: ts.Node, content: string): string {
  const ranges = ts.getLeadingCommentRanges(content, node.getFullStart()) ?? []
  for (const range of ranges) {
    const text = content.slice(range.pos, range.end)
    if (!text.startsWith("/**")) continue
    const normalized = text
      .replace(/^\/\*\*/, "")
      .replace(/\*\/$/, "")
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
    if (normalized.length > 0) return normalized[0]!
  }
  return ""
}

function extractMeta(sourceFile: ts.SourceFile): Record<string, unknown> | null {
  const exportedLiterals = collectExportedLiterals(sourceFile)
  const meta = exportedLiterals.meta
  return isPlainRecord(meta) ? meta : null
}

function collectExportedLiterals(sourceFile: ts.SourceFile): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
      const value = literalFromExpression(declaration.initializer)
      if (value !== NON_LITERAL) result[declaration.name.text] = value
    }
  }

  return result
}

function literalFromExpression(expression: ts.Expression): unknown {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isNumericLiteral(expression)) return Number(expression.text)
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null

  if (ts.isObjectLiteralExpression(expression)) {
    const result: Record<string, unknown> = {}
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) return NON_LITERAL
      const key = propertyNameText(property.name)
      if (!key) return NON_LITERAL
      const value = literalFromExpression(property.initializer)
      if (value === NON_LITERAL) return NON_LITERAL
      result[key] = value
    }
    return result
  }

  if (ts.isArrayLiteralExpression(expression)) {
    const values: unknown[] = []
    for (const element of expression.elements) {
      const value = literalFromExpression(element)
      if (value === NON_LITERAL) return NON_LITERAL
      values.push(value)
    }
    return values
  }

  return NON_LITERAL
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
