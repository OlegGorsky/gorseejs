export interface DeployArtifactConformanceInput {
  name: string
  content: string
  requiredTokens: string[]
  forbiddenTokens?: string[]
  format?: "text" | "json" | "toml"
  requiredPaths?: string[]
  requiredValues?: Array<{
    path: string
    value: string | number | boolean
  }>
}

export interface DeployArtifactConformanceResult {
  ok: boolean
  missing: string[]
  forbidden: string[]
  missingPaths: string[]
  mismatchedValues: string[]
}

export function validateDeployArtifactConformance(
  input: DeployArtifactConformanceInput,
): DeployArtifactConformanceResult {
  const missing = input.requiredTokens.filter((token) => !input.content.includes(token))
  const forbidden = (input.forbiddenTokens ?? []).filter((token) => input.content.includes(token))
  const structured = parseStructuredArtifact(input)
  const missingPaths = structured
    ? (input.requiredPaths ?? []).filter((path) => getStructuredValue(structured, path) === undefined)
    : []
  const mismatchedValues = structured
    ? (input.requiredValues ?? []).flatMap((expectation) => {
      const actual = getStructuredValue(structured, expectation.path)
      return actual === expectation.value
        ? []
        : [`${expectation.path}: expected ${String(expectation.value)}, received ${String(actual)}`]
    })
    : []
  return {
    ok: missing.length === 0 && forbidden.length === 0 && missingPaths.length === 0 && mismatchedValues.length === 0,
    missing,
    forbidden,
    missingPaths,
    mismatchedValues,
  }
}

export function assertDeployArtifactConformance(
  input: DeployArtifactConformanceInput,
): void {
  const result = validateDeployArtifactConformance(input)
  if (result.ok) return

  const problems = [
    ...result.missing.map((token) => `missing token: ${token}`),
    ...result.forbidden.map((token) => `forbidden token present: ${token}`),
    ...result.missingPaths.map((path) => `missing path: ${path}`),
    ...result.mismatchedValues.map((entry) => `mismatched value: ${entry}`),
  ].join("; ")

  throw new Error(`${input.name} failed deploy conformance: ${problems}`)
}

function parseStructuredArtifact(input: DeployArtifactConformanceInput): Record<string, unknown> | null {
  if (input.format === "json") {
    return JSON.parse(input.content) as Record<string, unknown>
  }
  if (input.format === "toml") {
    return parseToml(input.content)
  }
  return null
}

function getStructuredValue(record: Record<string, unknown>, path: string): unknown {
  let current: unknown = record
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function parseToml(content: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  let current: Record<string, unknown> = root

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    if (line.startsWith("[[") && line.endsWith("]]")) {
      const path = line.slice(2, -2).trim()
      const segments = path.split(".")
      const key = segments.pop()
      const parent = ensureTomlContainer(root, segments)
      if (!key) continue
      const list = Array.isArray(parent[key]) ? parent[key] as Record<string, unknown>[] : []
      const next: Record<string, unknown> = {}
      list.push(next)
      parent[key] = list
      current = next
      continue
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      const path = line.slice(1, -1).trim().split(".")
      current = ensureTomlContainer(root, path)
      continue
    }

    const separator = line.indexOf("=")
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    current[key] = parseTomlValue(value)
  }

  return root
}

function ensureTomlContainer(root: Record<string, unknown>, segments: string[]): Record<string, unknown> {
  let current = root
  for (const segment of segments) {
    const existing = current[segment]
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }
  return current
}

function parseTomlValue(value: string): unknown {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }
  if (value === "true") return true
  if (value === "false") return false
  if (/^-?\d+$/.test(value)) return Number(value)
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(",")
      .map((part) => parseTomlValue(part.trim()))
  }
  return value
}
