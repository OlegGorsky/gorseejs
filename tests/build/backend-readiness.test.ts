import { afterEach, describe, expect, test } from "bun:test"
import { registerBuiltInBuildBackends } from "../../src/build/backends/register.ts"
import { getBuildBackendReadiness } from "../../src/build/readiness.ts"
import { resetClientBuildBackend } from "../../src/build/client-backend.ts"

afterEach(() => {
  resetClientBuildBackend()
})

describe("build backend readiness", () => {
  test("reports stable build backend contract by default", () => {
    expect(getBuildBackendReadiness()).toEqual({
      envVar: "GORSEE_BUILD_BACKEND",
      stableDefault: "rolldown",
      preferredCanary: "experimental-rolldown",
      selected: "rolldown",
      resolvedFromEnv: "rolldown",
      registered: ["rolldown"],
      experimental: [],
    })
  })

  test("reports experimental build backends when registered", () => {
    registerBuiltInBuildBackends({ includeExperimentalRolldown: true })

    expect(getBuildBackendReadiness({ GORSEE_BUILD_BACKEND: "experimental-rolldown" })).toEqual({
      envVar: "GORSEE_BUILD_BACKEND",
      stableDefault: "rolldown",
      preferredCanary: "experimental-rolldown",
      selected: "rolldown",
      resolvedFromEnv: "experimental-rolldown",
      registered: ["experimental-rolldown", "rolldown"],
      experimental: ["experimental-rolldown"],
    })
  })
})
