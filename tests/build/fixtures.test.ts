import { beforeAll, afterAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createClientBuildFixtures } from "../../src/build/fixtures.ts"
import { createBunClientBuildBackend } from "../../src/build/client-backend.ts"
import { createExperimentalRolldownClientBuildBackend } from "../../src/build/backends/experimental-rolldown.ts"
import { compareClientBuildBackends } from "../../src/build/parity.ts"

let tmp = ""
let fixtures = createClientBuildFixtures()

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "gorsee-build-fixtures-"))
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

describe("build fixtures", () => {
  test("fixture corpus covers multiple build shapes", () => {
    expect(fixtures.map((fixture) => fixture.name)).toEqual([
      "plain-entry",
      "minified-entry",
      "multi-entry",
      "sourcemap-entry",
    ])
  })

  test("fixture corpus stays in parity across current build backends", async () => {
    const bun = createBunClientBuildBackend()
    const experimentalRolldown = createExperimentalRolldownClientBuildBackend({ fallback: bun })

    for (const fixture of fixtures) {
      const report = await compareClientBuildBackends(bun, experimentalRolldown, fixture.options)
      expect(report.matches).toBe(true)
      expect(report.outputMatches).toBe(true)
      expect(report.leftOutput.files).toEqual(report.rightOutput.files)
    }
  })
})
