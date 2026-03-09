import { describe, expect, test } from "bun:test"
import { createTypeScriptModuleAnalysisBackend } from "../../src/compiler/analysis-backend.ts"
import {
  createOxcModuleAnalysisBackend,
  getOxcBackendState,
  OXC_BACKEND_NAME,
  OXC_PACKAGE,
} from "../../src/compiler/backends/oxc.ts"
import { compareModuleAnalysisBackends } from "../../src/compiler/parity.ts"
import { MODULE_ANALYSIS_FIXTURES } from "../../src/compiler/fixtures.ts"

describe("OXC backend", () => {
  test("exposes explicit fallback capability state", () => {
    const typescript = createTypeScriptModuleAnalysisBackend()
    expect(getOxcBackendState({ fallback: typescript })).toEqual({
      backend: OXC_BACKEND_NAME,
      packageName: OXC_PACKAGE,
      implementation: "oxc-parser",
      available: true,
      fallbackBackend: "typescript",
      reason: null,
    })
  })

  test("stays in parity with typescript backend while in fallback mode", () => {
    const typescript = createTypeScriptModuleAnalysisBackend()
    const oxc = createOxcModuleAnalysisBackend({ fallback: typescript })
    const report = compareModuleAnalysisBackends(typescript, oxc, MODULE_ANALYSIS_FIXTURES)

    expect(report.leftBackend).toBe("typescript")
    expect(report.rightBackend).toBe("oxc")
    expect(report.checkedFiles).toBe(MODULE_ANALYSIS_FIXTURES.length)
    expect(report.matches).toBe(true)
    expect(report.leftSurface).toEqual(report.rightSurface)
    expect(report.differences).toEqual([])
  })
})
