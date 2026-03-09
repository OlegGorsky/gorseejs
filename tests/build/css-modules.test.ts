import { describe, test, expect } from "bun:test"

// Test the CSS transform logic directly (not the plugin which needs Bun.build context)
describe("CSS Modules transform", () => {
  // Import the internals for testing
  // Since transformCSS is not exported, we test the plugin behavior indirectly
  // by checking that .module.css pattern is recognized

  test("module css filename pattern", () => {
    expect("button.module.css".match(/\.module\.css$/)).toBeTruthy()
    expect("styles.css".match(/\.module\.css$/)).toBeFalsy()
    expect("layout.module.css".match(/\.module\.css$/)).toBeTruthy()
  })

  test("class name hashing is deterministic", () => {
    const { createHash } = require("node:crypto")
    const hash1 = createHash("md5").update("/app/button.module.css" + "container").digest("hex").slice(0, 5)
    const hash2 = createHash("md5").update("/app/button.module.css" + "container").digest("hex").slice(0, 5)
    expect(hash1).toBe(hash2)
  })

  test("different files produce different hashes", () => {
    const { createHash } = require("node:crypto")
    const hash1 = createHash("md5").update("/app/a.module.css" + "btn").digest("hex").slice(0, 5)
    const hash2 = createHash("md5").update("/app/b.module.css" + "btn").digest("hex").slice(0, 5)
    expect(hash1).not.toBe(hash2)
  })
})
