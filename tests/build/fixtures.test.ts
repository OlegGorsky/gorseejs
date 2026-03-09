import { beforeAll, afterAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { CLIENT_BUILD_FIXTURES } from "../../src/build/fixtures.ts"
import { createBunClientBuildBackend } from "../../src/build/client-backend.ts"
import { createExperimentalRolldownClientBuildBackend } from "../../src/build/backends/experimental-rolldown.ts"
import { compareClientBuildBackends } from "../../src/build/parity.ts"

const TMP = ".tmp-build-backend-parity"

beforeAll(async () => {
  await rm(TMP, { recursive: true, force: true })
  await mkdir(TMP, { recursive: true })
  await writeFile(`${TMP}/plain-entry.ts`, `export const value = 1\n`)
  await writeFile(`${TMP}/minified-entry.ts`, `export const answer = () => 42\n`)
  await writeFile(`${TMP}/multi-a.ts`, `export const left = "a"\n`)
  await writeFile(`${TMP}/multi-b.ts`, `export const right = "b"\n`)
  await writeFile(`${TMP}/sourcemap-entry.ts`, `export const source = () => ({ ok: true })\n`)
})

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true })
})

describe("build fixtures", () => {
  test("fixture corpus covers multiple build shapes", () => {
    expect(CLIENT_BUILD_FIXTURES.map((fixture) => fixture.name)).toEqual([
      "plain-entry",
      "minified-entry",
      "multi-entry",
      "sourcemap-entry",
    ])
  })

  test("fixture corpus stays in parity across current build backends", async () => {
    const bun = createBunClientBuildBackend()
    const experimentalRolldown = createExperimentalRolldownClientBuildBackend({ fallback: bun })

    for (const fixture of CLIENT_BUILD_FIXTURES) {
      const report = await compareClientBuildBackends(bun, experimentalRolldown, fixture.options)
      expect(report.matches).toBe(true)
      expect(report.outputMatches).toBe(true)
      expect(report.leftOutput.files).toEqual(report.rightOutput.files)
    }
  })
})
