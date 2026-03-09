import { describe, expect, test } from "bun:test"
import { MODULE_ANALYSIS_FIXTURES } from "../../src/compiler/fixtures.ts"
import { compareModuleAnalysisBackends } from "../../src/compiler/parity.ts"
import { createTypeScriptModuleAnalysisBackend } from "../../src/compiler/analysis-backend.ts"
import { createExperimentalOxcModuleAnalysisBackend } from "../../src/compiler/backends/experimental-oxc.ts"

describe("compiler fixtures", () => {
  test("fixture corpus covers multiple route shapes", () => {
    expect(MODULE_ANALYSIS_FIXTURES).toHaveLength(7)
    expect(MODULE_ANALYSIS_FIXTURES.map((fixture) => fixture.filePath)).toEqual([
      "routes/index.tsx",
      "routes/api/users.ts",
      "routes/dashboard.tsx",
      "routes/admin.tsx",
      "routes/settings.tsx",
      "routes/docs/[...parts].tsx",
      "routes/reports.tsx",
    ])
  })

  test("fixture corpus stays in parity across current analysis backends", () => {
    const typescript = createTypeScriptModuleAnalysisBackend()
    const experimentalOxc = createExperimentalOxcModuleAnalysisBackend({ fallback: typescript })
    const report = compareModuleAnalysisBackends(typescript, experimentalOxc, MODULE_ANALYSIS_FIXTURES)

    expect(report.checkedFiles).toBe(MODULE_ANALYSIS_FIXTURES.length)
    expect(report.differences).toEqual([])
  })
})
