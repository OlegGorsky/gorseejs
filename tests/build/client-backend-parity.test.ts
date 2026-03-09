import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  createBunClientBuildBackend,
  resetClientBuildBackend,
  type ClientBuildBackendOptions,
} from "../../src/build/client-backend.ts"
import { registerBuiltInBuildBackends } from "../../src/build/backends/register.ts"
import { createExperimentalRolldownClientBuildBackend } from "../../src/build/backends/experimental-rolldown.ts"
import { createRolldownClientBuildBackend } from "../../src/build/backends/rolldown.ts"
import { compareClientBuildBackends } from "../../src/build/parity.ts"

const TMP = join(process.cwd(), ".tmp-client-backend-parity")
const ENTRY = join(TMP, "entry.ts")
const OUTDIR = join(TMP, "dist")

beforeAll(async () => {
  await rm(TMP, { recursive: true, force: true })
  await mkdir(TMP, { recursive: true })
  await writeFile(ENTRY, `export const value = 1\n`)
})

afterEach(() => {
  resetClientBuildBackend()
})

describe("client build backend parity", () => {
  test("experimental Rolldown slot stays in parity with current Bun backend for result contract", async () => {
    const bun = createBunClientBuildBackend()
    const experimentalRolldown = createExperimentalRolldownClientBuildBackend({ fallback: bun })

    const options: ClientBuildBackendOptions = {
      entrypoints: [ENTRY],
      outdir: OUTDIR,
      minify: false,
      sourcemap: false,
      frameworkResolve() {
        return undefined
      },
      plugins: [],
    }

    const report = await compareClientBuildBackends(bun, experimentalRolldown, options)

    expect(report.leftBackend).toBe("bun")
    expect(report.rightBackend).toBe("experimental-rolldown")
    expect(report.matches).toBe(true)
    expect(report.outputMatches).toBe(true)
    expect(report.leftOutput.files).toEqual(report.rightOutput.files)
  })

  test("built-in build backend registration exposes experimental Rolldown slot when enabled", () => {
    const registered = registerBuiltInBuildBackends({ includeExperimentalRolldown: true, includeRolldown: true })
    expect(registered).toEqual(["experimental-rolldown", "rolldown"])
  })

  test("canonical Rolldown slot stays in parity with current Bun backend for result contract", async () => {
    const bun = createBunClientBuildBackend()
    const rolldown = createRolldownClientBuildBackend({ fallback: bun })

    const options: ClientBuildBackendOptions = {
      entrypoints: [ENTRY],
      outdir: OUTDIR,
      minify: false,
      sourcemap: false,
      frameworkResolve() {
        return undefined
      },
      plugins: [],
    }

    const report = await compareClientBuildBackends(bun, rolldown, options)

    expect(report.leftBackend).toBe("bun")
    expect(report.rightBackend).toBe("rolldown")
    expect(report.matches).toBe(true)
    expect(report.outputMatches).toBe(true)
    expect(report.leftOutput.files).toEqual(report.rightOutput.files)
  })

  test("built-in build backend registration can expose canonical Rolldown slot independently", () => {
    const registered = registerBuiltInBuildBackends({ includeRolldown: true })
    expect(registered).toEqual(["rolldown"])
  })
})
