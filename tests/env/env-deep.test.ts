import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { loadEnv, getPublicEnv, env } from "../../src/env/index.ts"
import { join } from "node:path"
import { writeFile, mkdir, rm } from "node:fs/promises"

const TMP = join(import.meta.dir, "__tmp_env_deep")

// Keys we create in this test -- cleaned up in afterAll
const TEST_KEYS = [
  "DEEP_A", "DEEP_B", "DEEP_C", "DEEP_SINGLE", "DEEP_DOUBLE",
  "DEEP_EMPTY", "DEEP_SPACED", "PUBLIC_DEEP_X", "DEEP_LOCAL_ONLY",
  "DEEP_OVERRIDE", "DEEP_HASH",
]

describe("env deep", () => {
  beforeAll(async () => {
    // Remove any leftover keys
    for (const k of TEST_KEYS) delete process.env[k]

    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })

    await writeFile(join(TMP, ".env"), [
      "DEEP_A=base_value",
      "DEEP_B=123",
      "DEEP_SINGLE='single quoted'",
      'DEEP_DOUBLE="double quoted"',
      "# full line comment",
      "",
      "  # indented comment",
      "DEEP_EMPTY=",
      "DEEP_SPACED = spaced_key ",
      "PUBLIC_DEEP_X=public_val",
      "DEEP_OVERRIDE=from_base",
      "DEEP_HASH=value#notcomment",
    ].join("\n"))

    await writeFile(join(TMP, ".env.local"), [
      "DEEP_LOCAL_ONLY=local_val",
      "DEEP_OVERRIDE=from_local",
    ].join("\n"))
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    for (const k of TEST_KEYS) delete process.env[k]
  })

  test("loadEnv reads .env file", async () => {
    await loadEnv(TMP)
    expect(process.env.DEEP_A).toBe("base_value")
  })

  test("loadEnv reads .env.local", () => {
    expect(process.env.DEEP_LOCAL_ONLY).toBe("local_val")
  })

  test("numeric value stays string", () => {
    expect(process.env.DEEP_B).toBe("123")
  })

  test("single-quoted value stripped", () => {
    expect(process.env.DEEP_SINGLE).toBe("single quoted")
  })

  test("double-quoted value stripped", () => {
    expect(process.env.DEEP_DOUBLE).toBe("double quoted")
  })

  test("comments ignored, no key created", () => {
    expect(process.env["# full line comment"]).toBeUndefined()
  })

  test("empty value parsed as empty string", () => {
    expect(process.env.DEEP_EMPTY).toBe("")
  })

  test("key with spaces trimmed", () => {
    expect(process.env.DEEP_SPACED).toBeDefined()
  })

  test("value with hash is kept as-is (not treated as comment)", () => {
    expect(process.env.DEEP_HASH).toBe("value#notcomment")
  })

  test("missing .env directory does not crash", async () => {
    await loadEnv("/tmp/__gorsee_nonexistent_dir")
    // Should not throw
  })

  test("env() returns loaded value", () => {
    expect(env("DEEP_A")).toBe("base_value")
  })

  test("env() with default for missing key", () => {
    expect(env("DEEP_NOPE", "def")).toBe("def")
  })

  test("env() throws for missing key without default", () => {
    expect(() => env("DEEP_NOPE")).toThrow("Missing required")
  })

  test("getPublicEnv includes PUBLIC_ prefixed vars", () => {
    const pub = getPublicEnv()
    expect(pub["PUBLIC_DEEP_X"]).toBe("public_val")
  })

  test("getPublicEnv excludes non-PUBLIC_ vars", () => {
    const pub = getPublicEnv()
    expect(pub["DEEP_A"]).toBeUndefined()
  })
})
