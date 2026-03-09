import { describe, test, expect } from "bun:test"
import { ERROR_CATALOG, type ErrorCode } from "../../src/errors/catalog.ts"
import { GorseeError, formatError, type FormattedError } from "../../src/errors/formatter.ts"

describe("error catalog deep", () => {
  test("ERROR_CATALOG has E001 entry", () => {
    expect(ERROR_CATALOG["E001"]).toBeDefined()
    expect(ERROR_CATALOG["E001"]!.code).toBe("E001")
  })

  test("each entry has code, title, description, fix", () => {
    for (const [key, entry] of Object.entries(ERROR_CATALOG)) {
      expect(entry.code as string).toBe(key)
      expect(typeof entry.title).toBe("string")
      expect(typeof entry.description).toBe("string")
      expect(typeof entry.fix).toBe("string")
    }
  })

  test("catalog contains type safety errors", () => {
    expect(ERROR_CATALOG["E001"]).toBeDefined()
    expect(ERROR_CATALOG["E002"]).toBeDefined()
  })

  test("catalog entries have non-empty strings", () => {
    for (const entry of Object.values(ERROR_CATALOG)) {
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.description.length).toBeGreaterThan(0)
      expect(entry.fix.length).toBeGreaterThan(0)
    }
  })
})

describe("GorseeError deep", () => {
  test("GorseeError extends Error", () => {
    const err = new GorseeError("E001")
    expect(err).toBeInstanceOf(Error)
  })

  test("GorseeError has code property", () => {
    const err = new GorseeError("E001")
    expect(err.code).toBe("E001")
  })

  test("GorseeError message includes code and title", () => {
    const err = new GorseeError("E001")
    expect(err.message).toContain("E001")
    expect(err.message).toContain("SafeSQL")
  })

  test("GorseeError with filePath and line", () => {
    const err = new GorseeError("E002", { filePath: "/app/src/foo.ts", line: 42 })
    expect(err.filePath).toBe("/app/src/foo.ts")
    expect(err.line).toBe(42)
  })

  test("GorseeError with extra detail", () => {
    const err = new GorseeError("E001", { extra: "in query()" })
    expect(err.message).toContain("in query()")
  })
})

describe("formatError deep", () => {
  test("formatError returns human and json", () => {
    const err = new GorseeError("E001")
    const result = formatError(err)
    expect(typeof result.human).toBe("string")
    expect(typeof result.json).toBe("object")
  })

  test("human output includes error code", () => {
    const result = formatError(new GorseeError("E001"))
    expect(result.human).toContain("E001")
  })

  test("human output includes title", () => {
    const result = formatError(new GorseeError("E001"))
    expect(result.human).toContain("SafeSQL")
  })

  test("human output includes fix suggestion", () => {
    const result = formatError(new GorseeError("E001"))
    expect(result.human).toContain("Fix:")
  })

  test("json has code, title, fix fields", () => {
    const result = formatError(new GorseeError("E002"))
    expect(result.json.code).toBe("E002")
    expect(result.json.title).toBe("SafeHTML violation")
    expect(typeof result.json.fix).toBe("string")
  })

  test("json includes file and line when provided", () => {
    const err = new GorseeError("E001", { filePath: "/a.ts", line: 10 })
    const result = formatError(err)
    expect(result.json.file).toBe("/a.ts")
    expect(result.json.line).toBe(10)
  })

  test("human output includes file location", () => {
    const err = new GorseeError("E001", { filePath: "/app/x.ts", line: 5 })
    const result = formatError(err)
    expect(result.human).toContain("/app/x.ts")
    expect(result.human).toContain(":5")
  })
})
