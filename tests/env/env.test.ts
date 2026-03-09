import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { loadEnv, getPublicEnv, env } from "../../src/env/index.ts"
import { join } from "node:path"
import { writeFile, mkdir, rm } from "node:fs/promises"

const TMP_DIR = join(import.meta.dir, "__tmp_env")

describe("env", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "development"
    await rm(TMP_DIR, { recursive: true, force: true })
    await mkdir(TMP_DIR, { recursive: true })

    await writeFile(join(TMP_DIR, ".env"), [
      "APP_NAME=gorsee-test",
      "PORT=3000",
      "PUBLIC_API_URL=https://api.example.com",
      "# This is a comment",
      'QUOTED="hello world"',
    ].join("\n"))

    await writeFile(join(TMP_DIR, ".env.development"), [
      "DEBUG=true",
    ].join("\n"))
  })

  afterAll(async () => {
    await rm(TMP_DIR, { recursive: true, force: true })
    // Clean up env vars
    delete process.env.APP_NAME
    delete process.env.PUBLIC_API_URL
    delete process.env.QUOTED
    delete process.env.DEBUG
  })

  test("loads .env file", async () => {
    await loadEnv(TMP_DIR)
    expect(process.env.APP_NAME).toBe("gorsee-test")
  })

  test("loads .env.development file", async () => {
    expect(process.env.DEBUG).toBe("true")
  })

  test("strips quotes from values", async () => {
    expect(process.env.QUOTED).toBe("hello world")
  })

  test("getPublicEnv returns only PUBLIC_ prefixed vars", () => {
    const publicVars = getPublicEnv()
    expect(publicVars.PUBLIC_API_URL).toBe("https://api.example.com")
    expect(publicVars.APP_NAME).toBeUndefined()
  })

  test("env() returns value", () => {
    expect(env("APP_NAME")).toBe("gorsee-test")
  })

  test("env() returns default when missing", () => {
    expect(env("MISSING_VAR", "fallback")).toBe("fallback")
  })

  test("env() throws when required var missing", () => {
    expect(() => env("NONEXISTENT")).toThrow("Missing required environment variable")
  })
})
