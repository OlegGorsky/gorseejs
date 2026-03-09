// gorsee migrate -- run database migrations
// gorsee migrate create <name> -- create new migration file

import { runMigrations, createMigration } from "../db/migrate.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

export interface MigrateCommandOptions extends RuntimeOptions {
  dbPath?: string
}

export async function runProjectMigrations(args: string[], options: MigrateCommandOptions = {}) {
  const { env, paths } = createProjectContext(options)
  const subcommand = args[0]

  if (subcommand === "create") {
    const name = args[1]
    if (!name) {
      console.error("Usage: gorsee migrate create <migration-name>")
      process.exit(1)
    }
    const filename = await createMigration(paths.migrationsDir, name)
    console.log(`\n  Created: migrations/${filename}\n`)
    return
  }

  // Default: run pending migrations
  const dbPath = options.dbPath ?? env.DATABASE_URL ?? paths.dataFile
  console.log("\n  Running migrations...\n")

  const result = await runMigrations(dbPath, paths.migrationsDir)

  if (result.applied.length > 0) {
    console.log("  Applied:")
    for (const m of result.applied) console.log(`    + ${m}`)
  }

  if (result.skipped.length > 0) {
    console.log(`  Skipped: ${result.skipped.length} (already applied)`)
  }

  if (result.errors.length > 0) {
    console.log("\n  Errors:")
    for (const e of result.errors) console.error(`    ! ${e}`)
    process.exit(1)
  }

  console.log(`\n  Done: ${result.applied.length} migration(s) applied\n`)
}

/** @deprecated Use runProjectMigrations() for programmatic access. */
export async function runMigrate(args: string[], options: MigrateCommandOptions = {}) {
  return runProjectMigrations(args, options)
}
