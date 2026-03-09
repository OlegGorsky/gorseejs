import type { ModuleAnalysisBackend, ModuleAnalysisFacts } from "./analysis-backend.ts"

export interface ModuleAnalysisParityFixture {
  filePath: string
  content: string
}

export interface ModuleAnalysisParityDifference {
  filePath: string
  field: "exportedNames" | "hasDefaultExport" | "title" | "meta" | "exportedLiterals" | "imports"
  left: unknown
  right: unknown
}

export interface ModuleAnalysisParityReport {
  leftBackend: string
  rightBackend: string
  checkedFiles: number
  matches: boolean
  leftSurface: ModuleAnalysisParitySurface[]
  rightSurface: ModuleAnalysisParitySurface[]
  differences: ModuleAnalysisParityDifference[]
}

export interface ModuleAnalysisParitySurface {
  filePath: string
  exportedNames: string[]
  hasDefaultExport: boolean
  title: string
  meta: Record<string, unknown> | null
  exportedLiterals: Record<string, unknown>
  imports: Array<{
    specifier: string
    names: string[]
    namespace?: string
    hasDefaultImport: boolean
  }>
}

export function compareModuleAnalysisBackends(
  leftBackend: ModuleAnalysisBackend,
  rightBackend: ModuleAnalysisBackend,
  fixtures: ModuleAnalysisParityFixture[],
): ModuleAnalysisParityReport {
  const differences: ModuleAnalysisParityDifference[] = []
  const leftSurface: ModuleAnalysisParitySurface[] = []
  const rightSurface: ModuleAnalysisParitySurface[] = []

  for (const fixture of fixtures) {
    const left = leftBackend.analyzeModuleSource(fixture.filePath, fixture.content)
    const right = rightBackend.analyzeModuleSource(fixture.filePath, fixture.content)
    leftSurface.push(normalizeModuleAnalysisFacts(fixture.filePath, left))
    rightSurface.push(normalizeModuleAnalysisFacts(fixture.filePath, right))
    collectDifferences(differences, fixture.filePath, left, right)
  }

  return {
    leftBackend: leftBackend.name,
    rightBackend: rightBackend.name,
    checkedFiles: fixtures.length,
    matches: differences.length === 0,
    leftSurface,
    rightSurface,
    differences,
  }
}

function collectDifferences(
  differences: ModuleAnalysisParityDifference[],
  filePath: string,
  left: ModuleAnalysisFacts,
  right: ModuleAnalysisFacts,
): void {
  if (!sameStringSets(left.exportedNames, right.exportedNames)) {
    differences.push({
      filePath,
      field: "exportedNames",
      left: [...left.exportedNames].sort(),
      right: [...right.exportedNames].sort(),
    })
  }

  if (left.hasDefaultExport !== right.hasDefaultExport) {
    differences.push({
      filePath,
      field: "hasDefaultExport",
      left: left.hasDefaultExport,
      right: right.hasDefaultExport,
    })
  }

  if (left.title !== right.title) {
    differences.push({
      filePath,
      field: "title",
      left: left.title,
      right: right.title,
    })
  }

  if (!sameJsonLike(left.meta, right.meta)) {
    differences.push({
      filePath,
      field: "meta",
      left: left.meta,
      right: right.meta,
    })
  }

  if (!sameJsonLike(left.exportedLiterals, right.exportedLiterals)) {
    differences.push({
      filePath,
      field: "exportedLiterals",
      left: left.exportedLiterals,
      right: right.exportedLiterals,
    })
  }

  if (!sameJsonLike(left.imports, right.imports)) {
    differences.push({
      filePath,
      field: "imports",
      left: left.imports,
      right: right.imports,
    })
  }
}

function sameStringSets(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

function sameJsonLike(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function normalizeModuleAnalysisFacts(filePath: string, facts: ModuleAnalysisFacts): ModuleAnalysisParitySurface {
  return {
    filePath,
    exportedNames: [...facts.exportedNames].sort(),
    hasDefaultExport: facts.hasDefaultExport,
    title: facts.title,
    meta: facts.meta,
    exportedLiterals: facts.exportedLiterals,
    imports: facts.imports.map((entry) => ({
      specifier: entry.specifier,
      names: [...entry.names],
      namespace: entry.namespace,
      hasDefaultImport: entry.hasDefaultImport,
    })),
  }
}
