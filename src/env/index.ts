// Environment variable loading from .env files
// Priority: .env.local > .env.{NODE_ENV} > .env
// Only PUBLIC_ prefixed vars are exposed to client bundles

import { readFile } from "node:fs/promises"
import { join } from "node:path"

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIndex = trimmed.indexOf("=")
    if (eqIndex < 0) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

async function loadFile(path: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(path, "utf-8")
    return parseEnvFile(content)
  } catch {
    return {}
  }
}

export async function loadEnv(cwd: string): Promise<void> {
  const mode = process.env.NODE_ENV ?? "development"

  // Load in priority order (lower priority first, higher overwrites)
  const files = [
    join(cwd, ".env"),
    join(cwd, `.env.${mode}`),
    join(cwd, ".env.local"),
  ]

  for (const file of files) {
    const vars = await loadFile(file)
    for (const [key, value] of Object.entries(vars)) {
      // Don't overwrite existing env vars (process env takes precedence)
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}

export function getPublicEnv(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("PUBLIC_") && value !== undefined) {
      result[key] = value
    }
  }
  return result
}

export function env(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`[GORSEE] Missing required environment variable: ${key}`)
  }
  return value
}
