import { afterEach, describe, expect, test } from "bun:test"
import { getCompilerBackendReadiness } from "../../src/compiler/readiness.ts"
import { registerBuiltInCompilerBackends } from "../../src/compiler/backends/register.ts"
import { resetModuleAnalysisBackend } from "../../src/compiler/module-analysis.ts"

afterEach(() => {
  resetModuleAnalysisBackend()
})

describe("compiler backend readiness", () => {
  test("reports stable compiler backend contract by default", () => {
    expect(getCompilerBackendReadiness()).toEqual({
      envVar: "GORSEE_COMPILER_BACKEND",
      stableDefault: "oxc",
      preferredCanary: "experimental-oxc",
      selected: "oxc",
      resolvedFromEnv: "oxc",
      registered: ["oxc"],
      experimental: [],
    })
  })

  test("reports experimental compiler backends when registered", () => {
    registerBuiltInCompilerBackends({ includeExperimentalOxc: true })

    expect(getCompilerBackendReadiness({ GORSEE_COMPILER_BACKEND: "experimental-oxc" })).toEqual({
      envVar: "GORSEE_COMPILER_BACKEND",
      stableDefault: "oxc",
      preferredCanary: "experimental-oxc",
      selected: "oxc",
      resolvedFromEnv: "experimental-oxc",
      registered: ["experimental-oxc", "oxc"],
      experimental: ["experimental-oxc"],
    })
  })
})
