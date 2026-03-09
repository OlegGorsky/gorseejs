import { parseSync } from "oxc-parser"
import type { ModuleAnalysisBackend, ModuleAnalysisFacts, ModuleImportFact } from "../analysis-backend.ts"

export const OXC_BACKEND_NAME = "oxc"
export const OXC_PACKAGE = "oxc-parser"

export interface OxcBackendState {
  backend: typeof OXC_BACKEND_NAME
  packageName: typeof OXC_PACKAGE
  implementation: "oxc-parser"
  available: true
  fallbackBackend: string
  reason: string | null
}

export interface OxcBackendOptions {
  fallback: ModuleAnalysisBackend
}

export function createOxcModuleAnalysisBackend(
  options: OxcBackendOptions,
): ModuleAnalysisBackend {
  return {
    name: OXC_BACKEND_NAME,
    analyzeModuleSource(filePath: string, content: string): ModuleAnalysisFacts {
      const result = parseSync(filePath, content, {
        lang: detectParserLang(filePath),
        sourceType: "module",
        astType: "ts",
      })

      if (result.errors.length > 0) {
        return options.fallback.analyzeModuleSource(filePath, content)
      }

      const program = result.program as unknown as OxcProgram
      return {
        exportedNames: collectExportedNames(program),
        hasDefaultExport: hasDefaultExport(program),
        title: extractTitle(program, result.comments, content),
        meta: extractMeta(program),
        exportedLiterals: collectExportedLiterals(program),
        imports: collectImports(result.module.staticImports),
        sourceFile: program,
      }
    },
  }
}

export function getOxcBackendState(
  options: OxcBackendOptions,
): OxcBackendState {
  return {
    backend: OXC_BACKEND_NAME,
    packageName: OXC_PACKAGE,
    implementation: "oxc-parser",
    available: true,
    fallbackBackend: options.fallback.name,
    reason: null,
  }
}

type OxcNode = {
  type: string
  start?: number
  end?: number
  [key: string]: unknown
}

type OxcProgram = OxcNode & {
  body: OxcNode[]
}

type OxcComment = {
  type: "Line" | "Block"
  value: string
  start: number
  end: number
}

function detectParserLang(filePath: string): "js" | "jsx" | "ts" | "tsx" {
  if (filePath.endsWith(".tsx")) return "tsx"
  if (filePath.endsWith(".ts")) return "ts"
  if (filePath.endsWith(".jsx")) return "jsx"
  return "js"
}

function collectImports(staticImports: Array<{
  entries: Array<{ importName: { kind: string }, localName: { value: string } }>
  moduleRequest: { value: string }
}>): ModuleImportFact[] {
  return staticImports.map((entry) => {
    const names: string[] = []
    let namespace: string | undefined
    let hasDefaultImport = false

    for (const specifier of entry.entries) {
      if (specifier.importName.kind === "Default") {
        hasDefaultImport = true
        continue
      }
      if (specifier.importName.kind === "NamespaceObject") {
        namespace = specifier.localName.value
        continue
      }
      names.push(specifier.localName.value)
    }

    return {
      specifier: entry.moduleRequest.value,
      names,
      namespace,
      hasDefaultImport,
    }
  })
}

function collectExportedNames(program: OxcProgram): Set<string> {
  const names = new Set<string>()

  for (const statement of program.body) {
    if (statement.type === "ExportNamedDeclaration") {
      const declaration = asNode(statement.declaration)
      const declarationId = asNode(declaration?.id)
      if (declaration?.type === "FunctionDeclaration" && identifierName(declarationId)) {
        names.add(identifierName(declarationId)!)
      }
      if (declaration?.type === "VariableDeclaration") {
        for (const declarator of asArray(declaration.declarations)) {
          const name = identifierName(asNode(declarator.id))
          if (name) names.add(name)
        }
      }
    }

    if (statement.type === "ExportDefaultDeclaration") {
      const declaration = asNode(statement.declaration)
      const declarationId = asNode(declaration?.id)
      if (
        declaration?.type === "FunctionDeclaration"
        && identifierName(declarationId)
      ) {
        names.add(identifierName(declarationId)!)
      }
    }
  }

  return names
}

function hasDefaultExport(program: OxcProgram): boolean {
  return program.body.some((statement) => statement.type === "ExportDefaultDeclaration")
}

function extractTitle(program: OxcProgram, comments: OxcComment[], content: string): string {
  const firstStatementStart = typeof program.body[0]?.start === "number" ? program.body[0].start : content.length
  const jsDoc = comments
    .filter((comment) => comment.type === "Block" && comment.end <= firstStatementStart)
    .map((comment) => content.slice(comment.start, comment.end))
    .find((comment) => comment.startsWith("/**"))

  if (!jsDoc) return ""

  const normalized = jsDoc
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)

  return normalized[0] ?? ""
}

function extractMeta(program: OxcProgram): Record<string, unknown> | null {
  const literals = collectExportedLiterals(program)
  return isPlainRecord(literals.meta) ? literals.meta : null
}

function collectExportedLiterals(program: OxcProgram): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue
    const declaration = asNode(statement.declaration)
    if (declaration?.type !== "VariableDeclaration") continue

    for (const declarator of asArray(declaration.declarations)) {
      const name = identifierName(asNode(declarator.id))
      if (!name) continue
      const value = literalFromExpression(asNode(declarator.init))
      if (value !== NON_LITERAL) result[name] = value
    }
  }

  return result
}

const NON_LITERAL = Symbol("non-literal")

function literalFromExpression(node: OxcNode | null): unknown {
  if (!node) return NON_LITERAL

  switch (node.type) {
    case "Literal":
      return node.value ?? null
    case "TemplateLiteral":
      if (asArray(node.expressions).length > 0) return NON_LITERAL
      return templateElementCooked(asNode(asArray(node.quasis)[0])) ?? ""
    case "ObjectExpression": {
      const result: Record<string, unknown> = {}
      for (const property of asArray(node.properties)) {
        if (property.type !== "Property") return NON_LITERAL
        const key = propertyKeyName(asNode(property.key))
        if (!key) return NON_LITERAL
        const value = literalFromExpression(asNode(property.value))
        if (value === NON_LITERAL) return NON_LITERAL
        result[key] = value
      }
      return result
    }
    case "ArrayExpression": {
      const result: unknown[] = []
      for (const element of asArray(node.elements)) {
        const value = literalFromExpression(asNode(element))
        if (value === NON_LITERAL) return NON_LITERAL
        result.push(value)
      }
      return result
    }
    default:
      return NON_LITERAL
  }
}

function propertyKeyName(node: OxcNode | null): string | null {
  if (!node) return null
  if (node.type === "Identifier") return stringOrNull(node.name)
  if (node.type === "Literal") {
    if (typeof node.value === "string" || typeof node.value === "number") return String(node.value)
  }
  return null
}

function identifierName(node: OxcNode | null): string | null {
  if (!node || node.type !== "Identifier") return null
  return stringOrNull(node.name)
}

function asNode(value: unknown): OxcNode | null {
  return value && typeof value === "object" ? value as OxcNode : null
}

function asArray(value: unknown): OxcNode[] {
  return Array.isArray(value) ? value as OxcNode[] : []
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function templateElementCooked(node: OxcNode | null): string | null {
  const value = node?.value
  if (!value || typeof value !== "object") return null
  const cooked = (value as { cooked?: unknown }).cooked
  return typeof cooked === "string" ? cooked : null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
