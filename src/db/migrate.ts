// Database migration runner
// Reads SQL files from migrations/ dir, applies in order
// Tracks applied migrations in _migrations table

import { Database } from "bun:sqlite"
import { readdir, readFile } from "node:fs/promises"
import { join, extname } from "node:path"

interface MigrationRecord {
  name: string
  applied_at: string
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
  errors: string[]
}

export async function runMigrations(dbPath: string, migrationsDir: string): Promise<MigrationResult> {
  const db = new Database(dbPath)
  db.run("PRAGMA journal_mode=WAL;")

  // Create migrations table if not exists
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  // Get already applied
  const applied = new Set(
    db.query("SELECT name FROM _migrations ORDER BY name").all()
      .map((r) => (r as MigrationRecord).name)
  )

  // Read migration files
  let files: string[]
  try {
    files = await readdir(migrationsDir)
  } catch {
    db.close()
    return { applied: [], skipped: [], errors: ["migrations/ directory not found"] }
  }

  const sqlFiles = files
    .filter((f) => extname(f) === ".sql")
    .sort()

  const result: MigrationResult = { applied: [], skipped: [], errors: [] }

  for (const file of sqlFiles) {
    if (applied.has(file)) {
      result.skipped.push(file)
      continue
    }

    try {
      const sql = await readFile(join(migrationsDir, file), "utf-8")
      db.run("BEGIN")
      try {
        db.run(sql)
        db.run("INSERT INTO _migrations (name) VALUES (?)", [file])
        db.run("COMMIT")
        result.applied.push(file)
      } catch (err) {
        db.run("ROLLBACK")
        throw err
      }
    } catch (err) {
      result.errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  db.close()
  return result
}

export async function createMigration(migrationsDir: string, name: string): Promise<string> {
  const { mkdir, writeFile } = await import("node:fs/promises")
  await mkdir(migrationsDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()
  const filename = `${timestamp}_${safeName}.sql`
  const filepath = join(migrationsDir, filename)

  await writeFile(filepath, `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n\n`)
  return filename
}
