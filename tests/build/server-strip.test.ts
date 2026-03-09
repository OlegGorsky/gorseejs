// Tests for server code stripping

import { describe, test, expect } from "bun:test"
import { serverStripPlugin } from "../../src/build/server-strip.ts"

describe("server strip plugin", () => {
  test("plugin is defined with correct name", () => {
    expect(serverStripPlugin).toBeDefined()
    expect(serverStripPlugin.name).toBe("gorsee-server-strip")
  })

  test("plugin has setup function", () => {
    expect(typeof serverStripPlugin.setup).toBe("function")
  })
})
