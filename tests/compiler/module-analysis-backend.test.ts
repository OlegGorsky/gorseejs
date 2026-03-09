import { afterEach, describe, expect, test } from "bun:test"
import {
  analyzeModuleSource,
  configureModuleAnalysisBackend,
  getModuleAnalysisBackend,
  GORSEE_COMPILER_BACKEND_ENV,
  listModuleAnalysisBackends,
  registerModuleAnalysisBackend,
  resolveModuleAnalysisBackendName,
  resetModuleAnalysisBackend,
  selectModuleAnalysisBackend,
  setModuleAnalysisBackend,
  unregisterModuleAnalysisBackend,
} from "../../src/compiler/module-analysis.ts"
import { createTypeScriptModuleAnalysisBackend, type ModuleAnalysisBackend } from "../../src/compiler/analysis-backend.ts"

afterEach(() => {
  resetModuleAnalysisBackend()
})

describe("module analysis backend", () => {
  test("uses oxc backend by default", () => {
    expect(getModuleAnalysisBackend().name).toBe("oxc")

    const facts = analyzeModuleSource("routes/index.tsx", `
      /** Home */
      import { Head } from "gorsee/client"
      export const meta = { title: "Home" }
      export default function Page() { return <main>{String(!!Head)}</main> }
    `)

    expect(facts.title).toBe("Home")
    expect(facts.meta).toEqual({ title: "Home" })
    expect(facts.imports[0]?.specifier).toBe("gorsee/client")
  })

  test("allows swapping analysis backend through stable adapter contract", () => {
    const backend: ModuleAnalysisBackend = {
      name: "stub",
      analyzeModuleSource() {
        return {
          exportedNames: new Set(["loader"]),
          hasDefaultExport: false,
          title: "stub",
          meta: null,
          exportedLiterals: { prerender: true },
          imports: [{ specifier: "gorsee/server", names: ["server"], hasDefaultImport: false }],
          sourceFile: null,
        }
      },
    }

    setModuleAnalysisBackend(backend)

    const facts = analyzeModuleSource("routes/index.tsx", "export default 1")

    expect(getModuleAnalysisBackend().name).toBe("stub")
    expect(facts.title).toBe("stub")
    expect(facts.exportedNames.has("loader")).toBe(true)
    expect(facts.exportedLiterals.prerender).toBe(true)
  })

  test("registers and selects named backends", () => {
    const backend: ModuleAnalysisBackend = {
      name: "experimental-oxc",
      analyzeModuleSource() {
        return {
          exportedNames: new Set(["GET"]),
          hasDefaultExport: false,
          title: "oxc",
          meta: null,
          exportedLiterals: {},
          imports: [],
          sourceFile: null,
        }
      },
    }

    registerModuleAnalysisBackend(backend)

    expect(listModuleAnalysisBackends()).toEqual(["experimental-oxc", "oxc"])
    expect(selectModuleAnalysisBackend("experimental-oxc").name).toBe("experimental-oxc")
    expect(analyzeModuleSource("routes/api.ts", "") .title).toBe("oxc")
  })

  test("supports selecting canonical OXC backend name", () => {
    const backend: ModuleAnalysisBackend = {
      name: "oxc",
      analyzeModuleSource() {
        return {
          exportedNames: new Set(["loader"]),
          hasDefaultExport: true,
          title: "canonical",
          meta: null,
          exportedLiterals: {},
          imports: [],
          sourceFile: null,
        }
      },
    }

    registerModuleAnalysisBackend(backend)

    expect(selectModuleAnalysisBackend("oxc").name).toBe("oxc")
    expect(analyzeModuleSource("routes/index.tsx", "").title).toBe("canonical")
  })

  test("configures backend from env contract", () => {
    const backend: ModuleAnalysisBackend = {
      name: "experimental-oxc",
      analyzeModuleSource() {
        return {
          exportedNames: new Set(),
          hasDefaultExport: true,
          title: "from-env",
          meta: null,
          exportedLiterals: {},
          imports: [],
          sourceFile: null,
        }
      },
    }

    registerModuleAnalysisBackend(backend)

    expect(resolveModuleAnalysisBackendName({ [GORSEE_COMPILER_BACKEND_ENV]: "experimental-oxc" })).toBe("experimental-oxc")
    expect(configureModuleAnalysisBackend({ [GORSEE_COMPILER_BACKEND_ENV]: "experimental-oxc" }).name).toBe("experimental-oxc")
    expect(analyzeModuleSource("routes/index.tsx", "").title).toBe("from-env")
  })

  test("ignores empty env override and falls back to oxc", () => {
    expect(resolveModuleAnalysisBackendName({ [GORSEE_COMPILER_BACKEND_ENV]: "   " })).toBe("oxc")
    expect(configureModuleAnalysisBackend({ [GORSEE_COMPILER_BACKEND_ENV]: "   " }).name).toBe("oxc")
  })

  test("restores oxc when custom backend is unregistered", () => {
    const backend: ModuleAnalysisBackend = {
      name: "experimental-oxc",
      analyzeModuleSource() {
        return {
          exportedNames: new Set(),
          hasDefaultExport: false,
          title: "",
          meta: null,
          exportedLiterals: {},
          imports: [],
          sourceFile: null,
        }
      },
    }

    registerModuleAnalysisBackend(backend)
    selectModuleAnalysisBackend("experimental-oxc")
    unregisterModuleAnalysisBackend("experimental-oxc")

    expect(getModuleAnalysisBackend().name).toBe("oxc")
    expect(listModuleAnalysisBackends()).toEqual(["oxc"])
  })

  test("throws on unknown backend selection", () => {
    expect(() => selectModuleAnalysisBackend("missing-backend")).toThrow("Unknown module analysis backend")
  })

  test("can restore canonical oxc backend", () => {
    setModuleAnalysisBackend({
      name: "stub",
      analyzeModuleSource() {
        return {
          exportedNames: new Set(),
          hasDefaultExport: false,
          title: "",
          meta: null,
          exportedLiterals: {},
          imports: [],
          sourceFile: null,
        }
      },
    })

    resetModuleAnalysisBackend()

    expect(getModuleAnalysisBackend().name).toBe("oxc")
    expect(createTypeScriptModuleAnalysisBackend().name).toBe("typescript")
    expect(listModuleAnalysisBackends()).toEqual(["oxc"])
  })
})
