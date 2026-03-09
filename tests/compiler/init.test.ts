import { afterEach, describe, expect, test } from "bun:test"
import { initializeCompilerBackends } from "../../src/compiler/init.ts"
import { getModuleAnalysisBackend, resetModuleAnalysisBackend } from "../../src/compiler/module-analysis.ts"

afterEach(() => {
  resetModuleAnalysisBackend()
})

describe("compiler backend initialization", () => {
  test("initializes default compiler backend when no env override is present", () => {
    const backend = initializeCompilerBackends({})
    expect(backend.name).toBe("oxc")
    expect(getModuleAnalysisBackend().name).toBe("oxc")
  })

  test("initializes experimental compiler backend from env", () => {
    const backend = initializeCompilerBackends({ GORSEE_COMPILER_BACKEND: "experimental-oxc" })
    expect(backend.name).toBe("experimental-oxc")
    expect(getModuleAnalysisBackend().name).toBe("experimental-oxc")
  })

  test("initializes canonical compiler backend from env", () => {
    const backend = initializeCompilerBackends({ GORSEE_COMPILER_BACKEND: "oxc" })
    expect(backend.name).toBe("oxc")
    expect(getModuleAnalysisBackend().name).toBe("oxc")
  })
})
