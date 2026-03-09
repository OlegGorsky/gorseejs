import { afterEach, describe, expect, test } from "bun:test"
import {
  configureClientBuildBackend,
  getClientBuildBackend,
  GORSEE_BUILD_BACKEND_ENV,
  listClientBuildBackends,
  registerClientBuildBackend,
  resetClientBuildBackend,
  resolveClientBuildBackendName,
  selectClientBuildBackend,
  setClientBuildBackend,
  unregisterClientBuildBackend,
  type ClientBuildBackend,
} from "../../src/build/client-backend.ts"

afterEach(() => {
  resetClientBuildBackend()
})

describe("client build backend", () => {
  test("uses rolldown backend by default", () => {
    expect(getClientBuildBackend().name).toBe("rolldown")
    expect(listClientBuildBackends()).toEqual(expect.arrayContaining(["bun", "rolldown"]))
  })

  test("allows swapping backend through stable adapter contract", () => {
    const backend: ClientBuildBackend = {
      name: "stub",
      async build() {
        return { success: true, logs: [{ message: "stub" }] }
      },
    }

    setClientBuildBackend(backend)

    expect(getClientBuildBackend().name).toBe("stub")
  })

  test("registers and selects named backends", () => {
    const backend: ClientBuildBackend = {
      name: "experimental-rolldown",
      async build() {
        return { success: true, logs: [] }
      },
    }

    registerClientBuildBackend(backend)

    expect(listClientBuildBackends()).toEqual(expect.arrayContaining(["bun", "experimental-rolldown", "rolldown"]))
    expect(selectClientBuildBackend("experimental-rolldown").name).toBe("experimental-rolldown")
  })

  test("supports selecting canonical Rolldown backend name", () => {
    const backend: ClientBuildBackend = {
      name: "rolldown",
      async build() {
        return { success: true, logs: [{ message: "canonical" }] }
      },
    }

    registerClientBuildBackend(backend)

    expect(selectClientBuildBackend("rolldown").name).toBe("rolldown")
  })

  test("configures backend from env contract", () => {
    const backend: ClientBuildBackend = {
      name: "experimental-rolldown",
      async build() {
        return { success: true, logs: [] }
      },
    }

    registerClientBuildBackend(backend)

    expect(resolveClientBuildBackendName({ [GORSEE_BUILD_BACKEND_ENV]: "experimental-rolldown" })).toBe("experimental-rolldown")
    expect(configureClientBuildBackend({ [GORSEE_BUILD_BACKEND_ENV]: "experimental-rolldown" }).name).toBe("experimental-rolldown")
  })

  test("ignores empty env override and falls back to rolldown", () => {
    expect(resolveClientBuildBackendName({ [GORSEE_BUILD_BACKEND_ENV]: "   " })).toBe("rolldown")
    expect(configureClientBuildBackend({ [GORSEE_BUILD_BACKEND_ENV]: "   " }).name).toBe("rolldown")
  })

  test("restores rolldown when custom backend is unregistered", () => {
    const backend: ClientBuildBackend = {
      name: "experimental-rolldown",
      async build() {
        return { success: true, logs: [] }
      },
    }

    registerClientBuildBackend(backend)
    selectClientBuildBackend("experimental-rolldown")
    unregisterClientBuildBackend("experimental-rolldown")

    expect(getClientBuildBackend().name).toBe("rolldown")
    expect(listClientBuildBackends()).toEqual(expect.arrayContaining(["bun", "rolldown"]))
  })

  test("throws on unknown backend selection", () => {
    expect(() => selectClientBuildBackend("missing-backend")).toThrow("Unknown client build backend")
  })
})
