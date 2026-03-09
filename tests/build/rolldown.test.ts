import { describe, expect, test } from "bun:test"
import { createBunClientBuildBackend } from "../../src/build/client-backend.ts"
import {
  createRolldownClientBuildBackend,
  getRolldownBackendState,
  ROLLDOWN_BACKEND_NAME,
  ROLLDOWN_PACKAGE,
} from "../../src/build/backends/rolldown.ts"
import { compareClientBuildBackends } from "../../src/build/parity.ts"
import { CLIENT_BUILD_FIXTURES } from "../../src/build/fixtures.ts"

describe("Rolldown backend", () => {
  test("exposes explicit Rolldown capability state", () => {
    const bun = createBunClientBuildBackend()
    expect(getRolldownBackendState({ fallback: bun })).toEqual({
      backend: ROLLDOWN_BACKEND_NAME,
      packageName: ROLLDOWN_PACKAGE,
      implementation: "rolldown",
      available: true,
      fallbackBackend: "bun",
      reason: null,
    })
  })

  test("stays in parity with bun backend for build result contract", async () => {
    const bun = createBunClientBuildBackend()
    const rolldown = createRolldownClientBuildBackend({ fallback: bun })

    for (const fixture of CLIENT_BUILD_FIXTURES) {
      const report = await compareClientBuildBackends(bun, rolldown, fixture.options)
      expect(report.leftBackend).toBe("bun")
      expect(report.rightBackend).toBe("rolldown")
      expect(report.matches).toBe(true)
      expect(report.outputMatches).toBe(true)
      expect(report.leftOutput.files).toEqual(report.rightOutput.files)
    }
  })
})
