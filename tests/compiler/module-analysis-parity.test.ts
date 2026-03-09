import { describe, expect, test } from "bun:test"
import { createTypeScriptModuleAnalysisBackend } from "../../src/compiler/analysis-backend.ts"
import { registerBuiltInCompilerBackends } from "../../src/compiler/backends/register.ts"
import { createExperimentalOxcModuleAnalysisBackend } from "../../src/compiler/backends/experimental-oxc.ts"
import { createOxcModuleAnalysisBackend } from "../../src/compiler/backends/oxc.ts"
import { compareModuleAnalysisBackends } from "../../src/compiler/parity.ts"
import { MODULE_ANALYSIS_FIXTURES } from "../../src/compiler/fixtures.ts"

describe("module analysis parity", () => {
  test("experimental OXC slot stays in parity with current TypeScript backend", () => {
    const typescript = createTypeScriptModuleAnalysisBackend()
    const experimentalOxc = createExperimentalOxcModuleAnalysisBackend({ fallback: typescript })
    const report = compareModuleAnalysisBackends(typescript, experimentalOxc, MODULE_ANALYSIS_FIXTURES)

    expect(report.leftBackend).toBe("typescript")
    expect(report.rightBackend).toBe("experimental-oxc")
    expect(report.checkedFiles).toBe(MODULE_ANALYSIS_FIXTURES.length)
    expect(report.matches).toBe(true)
    expect(report.leftSurface).toEqual(report.rightSurface)
    expect(report.differences).toEqual([])
  })

  test("built-in backend registration exposes experimental OXC slot when enabled", () => {
    const registered = registerBuiltInCompilerBackends({ includeExperimentalOxc: true, includeOxc: true })
    expect(registered).toEqual(["experimental-oxc", "oxc"])
  })

  test("canonical OXC slot stays in parity with current TypeScript backend", () => {
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

  test("built-in backend registration can expose canonical OXC slot independently", () => {
    const registered = registerBuiltInCompilerBackends({ includeOxc: true })
    expect(registered).toEqual(["oxc"])
  })
})
