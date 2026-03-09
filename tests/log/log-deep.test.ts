import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { log, setLogLevel } from "../../src/log/index.ts"

describe("log deep", () => {
  let captured: string[] = []
  const origLog = console.log
  const origError = console.error

  beforeEach(() => {
    captured = []
    console.log = (...args: unknown[]) => captured.push(String(args[0]))
    console.error = (...args: unknown[]) => captured.push(String(args[0]))
    setLogLevel("debug") // most permissive
  })

  afterEach(() => {
    console.log = origLog
    console.error = origError
    setLogLevel("info")
  })

  test("log.info is a function", () => {
    expect(typeof log.info).toBe("function")
  })

  test("log.error is a function", () => {
    expect(typeof log.error).toBe("function")
  })

  test("log.debug is a function", () => {
    expect(typeof log.debug).toBe("function")
  })

  test("log.verbose is a function", () => {
    expect(typeof log.verbose).toBe("function")
  })

  test("log.info outputs JSON with level and message", () => {
    log.info("test message")
    expect(captured).toHaveLength(1)
    const entry = JSON.parse(captured[0]!)
    expect(entry.level).toBe("info")
    expect(entry.message).toBe("test message")
  })

  test("log.error outputs to console.error", () => {
    log.error("err msg")
    expect(captured).toHaveLength(1)
    const entry = JSON.parse(captured[0]!)
    expect(entry.level).toBe("error")
  })

  test("log output includes timestamp", () => {
    log.info("ts test")
    const entry = JSON.parse(captured[0]!)
    expect(entry.timestamp).toBeDefined()
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })

  test("log with metadata object", () => {
    log.info("with data", { userId: 42, action: "login" })
    const entry = JSON.parse(captured[0]!)
    expect(entry.userId).toBe(42)
    expect(entry.action).toBe("login")
  })

  test("setLogLevel to info hides debug messages", () => {
    setLogLevel("info")
    log.debug("hidden")
    expect(captured).toHaveLength(0)
  })

  test("setLogLevel to info shows info messages", () => {
    setLogLevel("info")
    log.info("visible")
    expect(captured).toHaveLength(1)
  })

  test("setLogLevel to error hides info and debug", () => {
    setLogLevel("error")
    log.info("hidden")
    log.debug("hidden too")
    log.verbose("also hidden")
    expect(captured).toHaveLength(0)
  })

  test("error messages shown at all levels except off", () => {
    for (const level of ["error", "info", "verbose", "debug"] as const) {
      captured = []
      setLogLevel(level)
      log.error("visible")
      expect(captured).toHaveLength(1)
    }
  })

  test("setLogLevel off suppresses everything", () => {
    setLogLevel("off")
    log.error("nope")
    log.info("nope")
    log.debug("nope")
    expect(captured).toHaveLength(0)
  })

  test("verbose messages shown at verbose level", () => {
    setLogLevel("verbose")
    log.verbose("vis")
    expect(captured).toHaveLength(1)
  })

  test("verbose messages hidden at info level", () => {
    setLogLevel("info")
    log.verbose("hidden")
    expect(captured).toHaveLength(0)
  })
})
