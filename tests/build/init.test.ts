import { afterEach, describe, expect, test } from "bun:test"
import { initializeBuildBackends } from "../../src/build/init.ts"
import { getClientBuildBackend, resetClientBuildBackend } from "../../src/build/client-backend.ts"

afterEach(() => {
  resetClientBuildBackend()
})

describe("build backend initialization", () => {
  test("initializes default build backend when no env override is present", () => {
    const backend = initializeBuildBackends({})
    expect(backend.name).toBe("rolldown")
    expect(getClientBuildBackend().name).toBe("rolldown")
  })

  test("initializes experimental build backend from env", () => {
    const backend = initializeBuildBackends({ GORSEE_BUILD_BACKEND: "experimental-rolldown" })
    expect(backend.name).toBe("experimental-rolldown")
    expect(getClientBuildBackend().name).toBe("experimental-rolldown")
  })

  test("initializes canonical build backend from env", () => {
    const backend = initializeBuildBackends({ GORSEE_BUILD_BACKEND: "rolldown" })
    expect(backend.name).toBe("rolldown")
    expect(getClientBuildBackend().name).toBe("rolldown")
  })
})
