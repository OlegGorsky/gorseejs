#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { CLIENT_BUILD_FIXTURES } from "../src/build/fixtures.ts"
import { createBunClientBuildBackend } from "../src/build/client-backend.ts"
import { createExperimentalRolldownClientBuildBackend } from "../src/build/backends/experimental-rolldown.ts"
import { createRolldownClientBuildBackend } from "../src/build/backends/rolldown.ts"
import { compareClientBuildBackends } from "../src/build/parity.ts"

const repoRoot = resolve(import.meta.dirname, "..")
const tmpRoot = resolve(repoRoot, ".tmp-build-backend-parity")
rmSync(tmpRoot, { recursive: true, force: true })
mkdirSync(tmpRoot, { recursive: true })

writeFileSync(resolve(repoRoot, ".tmp-build-backend-parity/plain-entry.ts"), `export const value = 1\n`)
writeFileSync(resolve(repoRoot, ".tmp-build-backend-parity/minified-entry.ts"), `export const answer = () => 42\n`)
writeFileSync(resolve(repoRoot, ".tmp-build-backend-parity/multi-a.ts"), `export const left = "a"\n`)
writeFileSync(resolve(repoRoot, ".tmp-build-backend-parity/multi-b.ts"), `export const right = "b"\n`)
writeFileSync(resolve(repoRoot, ".tmp-build-backend-parity/sourcemap-entry.ts"), `export const source = () => ({ ok: true })\n`)

const bun = createBunClientBuildBackend()
const experimentalRolldown = createExperimentalRolldownClientBuildBackend({ fallback: bun })
const rolldown = createRolldownClientBuildBackend({ fallback: bun })

const reports = []
for (const fixture of CLIENT_BUILD_FIXTURES) {
  const experimentalReport = await compareClientBuildBackends(bun, experimentalRolldown, fixture.options)
  reports.push({
    fixture: fixture.name,
    ...experimentalReport,
  })
  const rolldownReport = await compareClientBuildBackends(bun, rolldown, fixture.options)
  reports.push({
    fixture: fixture.name,
    ...rolldownReport,
  })
}

console.log(JSON.stringify(reports, null, 2))

if (reports.some((report) => report.matches !== true)) {
  process.exitCode = 1
}
