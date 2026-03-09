import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { runMigrations, createMigration } from "../../src/db/migrate.ts"
import { join } from "node:path"
import { mkdir, writeFile, rm } from "node:fs/promises"

const TMP_DIR = join(import.meta.dir, "__tmp_migrate")
const DB_PATH = join(TMP_DIR, "test.sqlite")
const MIGRATIONS_DIR = join(TMP_DIR, "migrations")

describe("migrations", () => {
  beforeAll(async () => {
    await rm(TMP_DIR, { recursive: true, force: true })
    await mkdir(MIGRATIONS_DIR, { recursive: true })

    await writeFile(join(MIGRATIONS_DIR, "001_create_users.sql"),
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);")

    await writeFile(join(MIGRATIONS_DIR, "002_create_posts.sql"),
      "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL, user_id INTEGER REFERENCES users(id));")
  })

  afterAll(async () => {
    await rm(TMP_DIR, { recursive: true, force: true })
  })

  test("runs pending migrations", async () => {
    const result = await runMigrations(DB_PATH, MIGRATIONS_DIR)
    expect(result.applied).toEqual(["001_create_users.sql", "002_create_posts.sql"])
    expect(result.errors).toHaveLength(0)
  })

  test("skips already applied migrations", async () => {
    const result = await runMigrations(DB_PATH, MIGRATIONS_DIR)
    expect(result.applied).toHaveLength(0)
    expect(result.skipped).toEqual(["001_create_users.sql", "002_create_posts.sql"])
  })

  test("handles SQL errors gracefully", async () => {
    await writeFile(join(MIGRATIONS_DIR, "003_bad.sql"), "INVALID SQL STATEMENT;")
    const result = await runMigrations(DB_PATH, MIGRATIONS_DIR)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("003_bad.sql")
    // Clean up bad migration
    await rm(join(MIGRATIONS_DIR, "003_bad.sql"))
  })

  test("createMigration creates file with timestamp", async () => {
    const filename = await createMigration(MIGRATIONS_DIR, "add_email_to_users")
    expect(filename).toMatch(/^\d{14}_add_email_to_users\.sql$/)
  })
})
