import { describe, test, expect, beforeEach, afterEach, afterAll } from "bun:test"
import { runMigrations, createMigration } from "../../src/db/migrate.ts"
import { Database } from "bun:sqlite"
import { join } from "node:path"
import { mkdir, writeFile, rm, readdir } from "node:fs/promises"

const TMP = join(import.meta.dir, "__tmp_migrate_deep")
const DB_PATH = join(TMP, "test.sqlite")
const MIG_DIR = join(TMP, "migrations")

describe("migrate deep", () => {
  beforeEach(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(MIG_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(join(TMP, "test.sqlite-wal"), { force: true })
    await rm(join(TMP, "test.sqlite-shm"), { force: true })
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("runMigrations creates _migrations table", async () => {
    const result = await runMigrations(DB_PATH, MIG_DIR)
    const db = new Database(DB_PATH)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'").all()
    db.close()
    expect(tables).toHaveLength(1)
  })

  test("applies SQL files in alphabetical order", async () => {
    await writeFile(join(MIG_DIR, "002_second.sql"), "CREATE TABLE second (id INTEGER);")
    await writeFile(join(MIG_DIR, "001_first.sql"), "CREATE TABLE first (id INTEGER);")
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(result.applied).toEqual(["001_first.sql", "002_second.sql"])
  })

  test("skips already applied migrations", async () => {
    await writeFile(join(MIG_DIR, "001_init.sql"), "CREATE TABLE t (id INTEGER);")
    await runMigrations(DB_PATH, MIG_DIR)
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(result.applied).toHaveLength(0)
    expect(result.skipped).toEqual(["001_init.sql"])
  })

  test("records applied migration in _migrations table", async () => {
    await writeFile(join(MIG_DIR, "001_init.sql"), "CREATE TABLE t (id INTEGER);")
    await runMigrations(DB_PATH, MIG_DIR)
    const db = new Database(DB_PATH)
    const rows = db.query("SELECT name FROM _migrations").all() as { name: string }[]
    db.close()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe("001_init.sql")
  })

  test("error in migration rolls back (table not created)", async () => {
    await writeFile(join(MIG_DIR, "001_bad.sql"), "INVALID SQL;")
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("001_bad.sql")
    const db = new Database(DB_PATH)
    const applied = db.query("SELECT name FROM _migrations").all()
    db.close()
    expect(applied).toHaveLength(0)
  })

  test("createMigration creates file with timestamp prefix", async () => {
    const filename = await createMigration(MIG_DIR, "add_users")
    expect(filename).toMatch(/^\d{14}_add_users\.sql$/)
    const files = await readdir(MIG_DIR)
    expect(files).toContain(filename)
  })

  test("createMigration sanitizes special characters in name", async () => {
    const filename = await createMigration(MIG_DIR, "add spaces & symbols!")
    expect(filename).toMatch(/^\d{14}_add_spaces___symbols_\.sql$/)
  })

  test("empty migrations directory returns empty results", async () => {
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(result.applied).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  test("non-.sql files are ignored", async () => {
    await writeFile(join(MIG_DIR, "readme.txt"), "not a migration")
    await writeFile(join(MIG_DIR, "001_real.sql"), "CREATE TABLE t (id INTEGER);")
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(result.applied).toEqual(["001_real.sql"])
  })

  test("multiple migrations applied in sequence", async () => {
    await writeFile(join(MIG_DIR, "001_a.sql"), "CREATE TABLE a (id INTEGER);")
    await writeFile(join(MIG_DIR, "002_b.sql"), "CREATE TABLE b (id INTEGER);")
    await writeFile(join(MIG_DIR, "003_c.sql"), "CREATE TABLE c (id INTEGER);")
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(result.applied).toHaveLength(3)
    expect(result.errors).toHaveLength(0)
  })

  test("missing migrations directory returns error", async () => {
    const result = await runMigrations(DB_PATH, join(TMP, "nonexistent"))
    expect(result.errors).toContain("migrations/ directory not found")
  })

  test("result has applied/skipped/errors arrays", async () => {
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(Array.isArray(result.applied)).toBe(true)
    expect(Array.isArray(result.skipped)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })

  test("second migration error does not block first", async () => {
    await writeFile(join(MIG_DIR, "001_ok.sql"), "CREATE TABLE ok (id INTEGER);")
    await writeFile(join(MIG_DIR, "002_bad.sql"), "INVALID;")
    const result = await runMigrations(DB_PATH, MIG_DIR)
    expect(result.applied).toEqual(["001_ok.sql"])
    expect(result.errors).toHaveLength(1)
  })
})
