import { describe, expect, test } from "bun:test"

describe("dev runtime module contract", () => {
  test("dev server module is import-safe and exposes explicit lifecycle API", async () => {
    const devModule = await import("../../src/dev.ts")
    expect(typeof devModule.startDevServer).toBe("function")
  })

  test("dev runtime exports HMR origin gate helper", async () => {
    const devModule = await import("../../src/dev.ts")
    expect(
      devModule.isAllowedHMROrigin(
        new Request("http://localhost:3000/__gorsee_hmr", {
          headers: { Origin: "http://localhost:3000" },
        }),
        "http://localhost:3000",
      ),
    ).toBe(true)
    expect(
      devModule.isAllowedHMROrigin(
        new Request("http://localhost:3000/__gorsee_hmr", {
          headers: { Origin: "https://evil.example" },
        }),
        "http://localhost:3000",
      ),
    ).toBe(false)
  })

  test("cmd-dev uses direct server startup API instead of shell spawning", async () => {
    const cmdDevSource = await Bun.file(new URL("../../src/cli/cmd-dev.ts", import.meta.url)).text()
    expect(cmdDevSource).toContain('startDevServer')
    expect(cmdDevSource).not.toContain("Bun.spawn")
  })
})
