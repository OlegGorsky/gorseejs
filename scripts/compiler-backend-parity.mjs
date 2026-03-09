#!/usr/bin/env node

import { MODULE_ANALYSIS_FIXTURES } from "../src/compiler/fixtures.ts"
import { createTypeScriptModuleAnalysisBackend } from "../src/compiler/analysis-backend.ts"
import { createExperimentalOxcModuleAnalysisBackend } from "../src/compiler/backends/experimental-oxc.ts"
import { createOxcModuleAnalysisBackend } from "../src/compiler/backends/oxc.ts"
import { compareModuleAnalysisBackends } from "../src/compiler/parity.ts"

const typescript = createTypeScriptModuleAnalysisBackend()
const experimentalOxc = createExperimentalOxcModuleAnalysisBackend({ fallback: typescript })
const oxc = createOxcModuleAnalysisBackend({ fallback: typescript })

const reports = [
  compareModuleAnalysisBackends(typescript, experimentalOxc, MODULE_ANALYSIS_FIXTURES),
  compareModuleAnalysisBackends(typescript, oxc, MODULE_ANALYSIS_FIXTURES),
]

console.log(JSON.stringify(reports, null, 2))

if (reports.some((report) => report.differences.length > 0)) {
  process.exitCode = 1
}
