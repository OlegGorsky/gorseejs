import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createBunClientBuildBackend } from "../../src/build/client-backend.ts"
import {
  createRolldownClientBuildBackend,
  getRolldownBackendState,
  ROLLDOWN_BACKEND_NAME,
  ROLLDOWN_PACKAGE,
} from "../../src/build/backends/rolldown.ts"
import { compareClientBuildBackends } from "../../src/build/parity.ts"
import { createClientBuildFixtures } from "../../src/build/fixtures.ts"

let tmp = ""
let fixtures = createClientBuildFixtures()

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "gorsee-rolldown-fixtures-"))
  fixtures = createClientBuildFixtures(tmp)
  await mkdir(tmp, { recursive: true })
  await writeFile(`${tmp}/plain-entry.ts`, `export const value = 1\n`)
  await writeFile(`${tmp}/minified-entry.ts`, `export const answer = () => 42\n`)
  await writeFile(`${tmp}/multi-a.ts`, `export const left = "a"\n`)
  await writeFile(`${tmp}/multi-b.ts`, `export const right = "b"\n`)
  await writeFile(`${tmp}/sourcemap-entry.ts`, `export const source = () => ({ ok: true })\n`)
})

afterAll(async () => {
  if (tmp) {
    await rm(tmp, { recursive: true, force: true })
  }
})

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

    for (const fixture of fixtures) {
      const report = await compareClientBuildBackends(bun, rolldown, fixture.options)
      expect(report.leftBackend).toBe("bun")
      expect(report.rightBackend).toBe("rolldown")
      expect(report.matches).toBe(true)
      expect(report.outputMatches).toBe(true)
      expect(report.leftOutput.files).toEqual(report.rightOutput.files)
    }
  })
})
